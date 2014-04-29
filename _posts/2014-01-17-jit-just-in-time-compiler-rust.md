---
layout: post
published: true
title: A Just-in-time Compiler In Rust
---

Today, we're going to build a simple, very simple, JIT compiler in [Rust](http://rust-lang.org). Rust is a safe, concurrent, and practical language that aims at replacing C++ and become a better systems language.

Now, this is only the actual just-in-time compiler that we'll be implementing, not a language compiler, nor the encoding of machine instructions; the latter requires a lot of knowledge about the CPU instruction specification, such as x86.

If you'd like to use a production grade JIT compiler, there's [LLVM][2] and [LibJit][3], just to name a couple.

---

What exactly is a *[just-in-time (JIT)](https://en.wikipedia.org/wiki/Just-in-time_compilation)* compiler? I think the following quote does a justice explanation.

> Whenever a program, while running, creates and runs some new executable code which was not part of the program when it was stored on disk, it’s a JIT. - [Eli Bendersky][1]

---

Before we get started, you'll need to get yourself a copy of the [Rust compiler](https://github.com/mozilla/rust). The current version, as of this writing &mdash; is 0.9. I'll be updating this article to be applicable to future versions. But, if I don't get to it in time, let me know.

Be aware that the Rust compiler takes a fairly long time to compile, mainly because it's a [bootstrapped compiler](https://en.wikipedia.org/wiki/Bootstrapping_(compilers). Thus, the compiler itself is written in Rust. Yeah, that might be confusing, but it makes the development of a language much more streamlined at the cost of more complexity. Currently, as far as I'm aware, the Rust compiler must [compile itself 3 times][4]. It also has to compile it's dependencies, such as [LLVM][2], [libuv](https://github.com/joyent/libuv), only once.

## Safety & Interop

Let's begin by talking about safety, considering it's one of Rust's principles to begin with. Creating a JIT compiler was one of the first things I tried implementing within Rust. Why? Well, I got straight down to the core system, and, thus, I was able to clearly see how Rust was at handling low-level programming, and C-interop.

Most of the constructs within a JIT compiler that handles any logic will be unsafe. Remember, I'm talking about the JIT being the logic that handles the dynamic execution of code, machine code. If you'd build a VM around this &mdash; or *a* JIT compiler &mdash; you could minimize the amount of unsafe code you'd use. It would be much easier to prove that 1000 lines of code is correct, yourself, and let the compiler prove the rest; rather than having to prove mostly *everything* is correct yourself. This is what Rust offers. A way to minimize the amount of unsafe code you write and read.

The end result would ultimately be to expose *safe* interfaces to **all** logic. That's how we're going to work.

### Rust Modules

Let's define the files, effectively modules, that we're going to write.

Here's our project's directory contents:

```
src/
  main.rs
  raw.rs
  region.rs
  safe.rs
```

We'll be compiling all our examples with with `rustc`, Rust's compiler executable:

```bash
mkdir -p bin && rustc -Z debug-info src/main.rs -o bin/jit
```

We simply create a new folder `bin` that will hold the compiled program. You can place this into a `Makefile` if you'd like, for simplicity.

`main.rs` will contain our program logic. This will contain our examples that will use our JIT compiler.

`raw.rs` are C function interfaces. Libc is linked by default with Rust programs, so there are no extra efforts to include the library.

`region.rs` will hold a Rust-idiomatic struct `MappedRegion` that contain some raw pointers, which are unsafe. We also define some implementations for a couple [Traits][5].

`safe.rs` will contain *safe* interfaces to native C functions.

--

Let's begin with the `raw.rs` module. We'll begin by including the `libc` module.

```rust
// src/raw.rs
use std::libc;
```

Next, we'll want to define some external functions, C functions. These are **all** unsafe.

```rust
// src/raw.rs
use std::libc;

extern {}
```

You don't *need* to understand the next function interfaces. They're interfaces to libc functions, such as `mmap`, `memcpy`, etc...

```rust
// src/raw.rs
use std::libc;

extern {

    pub fn mmap(
        addr : *libc::c_char,
        length : libc::size_t,
        prot : libc::c_int,
        flags  : libc::c_int,
        fd   : libc::c_int,
        offset : libc::off_t
    ) -> *u8;

    pub fn munmap(
        addr : *u8,
        length : libc::size_t
    ) -> libc::c_int;

    pub fn mprotect(
        addr: *libc::c_void,
        length: libc::size_t,
        prot: libc::c_int
    ) -> libc::c_int;

    pub fn memcpy(
        dest: *libc::c_void,
        src: *libc::c_void,
        n: libc::size_t
    ) -> *libc::c_void;
}
```

We don't need to define the actual contents of these functions, because they will be included in the compiled binary by linking with libc.

Next, we'll also include some flags that interop with these functions.

```rust
// src/raw.rs
use std::libc;

extern {...}

pub static PROT_NONE   : libc::c_int = 0x0;
pub static PROT_READ   : libc::c_int = 0x1;
pub static PROT_WRITE  : libc::c_int = 0x2;
pub static PROT_EXEC   : libc::c_int = 0x4;

pub static MAP_SHARED  : libc::c_int = 0x1;
pub static MAP_PRIVATE : libc::c_int = 0x2;
```

---

Awesome, we're now done with the `src/raw.rs` module. As you can see, it's dead simple to interop with C code.

Because Rust is trying to provide a way to build **safer** software, we need to take advantage of this. Thus, we want to wrap the main portion of the state in a *safe* struct.

But, before we get into that, let's go through how we can execute machine code dynamically.

## Execution

The first portion we need is to store our instructions somewhere in memory. Ok, so how about malloc? While malloc works on traditional data, we have some very specific requirements &mdash; them being that we need to control the memory's protection flags, and malloc doesn't give us that ability.

Mmap is exactly what we need. We need to create a new memory mapped region with some custom protection. Initially, we only need to read and write to the region. But, we'll need to change the protection to turn off writing *then* enable executation. By default, you cannot try and execute normal malloced memory. Well, you can try, but the program will blow up because of security reasons. Having a memory region that is *both* writable **and** executable is dangerously insecure. That's why we need to do it in steps.

* Allocate a new memory region of the size we need.
* Make the region readable **and** writable.
* Commit our instructions to that region.
* Make it read-only and executable.

---

Let's get to starting `src/region.rs`. When we create a new memory region with `mmap`, we'll receive a pointer; which points to the beginning of the new memory block. This isn't safe, so we'll abstract it around safer constructs.

```rust
// src/region.rs
use std::os;
use std;

mod raw;
```

Let's include the specific modules we need from the standard library, then define a local module we need to use &mdash; our raw module containing the C interfaces/prototypes.

```rust
// src/region.rs
use std::os;
use std;

mod raw;

pub struct MappedRegion {
    addr: *u8,
    len: u64
}
```

We are defining a new struct that wraps the dirty, raw pointer; and holds the length of the memory region.

The following implementations of Traits are for printing and memory deallocation, respectively.

{% highlight rust %}
// src/region.rs
...

impl std::fmt::Default for MappedRegion {
    fn fmt(value: &MappedRegion, f: &mut std::fmt::Formatter) {
        write!(f.buf, "MappedRegion\\{ {}, {}\\}",
          value.addr, value.len
        );
    }
}
{% endhighlight %}

{% highlight rust %}
// src.region.rs
...

impl Drop for MappedRegion {
    #[inline(never)]
    fn drop(&mut self) {
        unsafe {
            if raw::munmap(self.addr, self.len) < 0 {
                fail!(format!("munmap({}, {}): {}",
                  self.addr,
                  self.len,
                  os::last_os_error()
                ));
            }
        }
    }
}
{% endhighlight %}

I'm not going to go into much detail on the `Drop` trait, but this destructor will be called whenever the *owner* of the `MappedRegion` instance has gone out of scope.

---

As with the Rust model of providing *safe* interfaces, we need to define friendlier functions than the raw C functions.

Let's create our `safe.rs` module.

{% highlight rust %}
// src/safe.rs
use region::MappedRegion;
use std::libc::{c_char, size_t, c_void};
use std::libc;
use std::os;

mod raw;
mod region;
{% endhighlight %}

We'll start off by including some modules.

{% highlight rust %}
// src/safe.rs
...

pub fn mmap(size: u64) -> Result<~MappedRegion, ~str> {
    unsafe {
        let buf = raw::mmap(
            0 as *libc::c_char,
            size,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_PRIVATE | libc::MAP_ANON,
            -1,
            0
        );

        if buf == -1 as *u8 {
          Err(os::last_os_error())
        } else {
          Ok(~MappedRegion{ addr: buf, len: size })
        }
    }
}
{% endhighlight %}

Now, we defined a *safe* version of mmap. Thus, we don't accept unsafe inputs or outputs &mdash; no null points allowed.

{% highlight rust %}
Result<~MappedRegion, ~str>
{% endhighlight %}

`Result` is one of Rust's types that provide safer and more expression code. `Result` includes two cases: Ok, and Err. This allows us to mattern match accordingly.

{% highlight rust %}
// example
let region = match mmap(1024) {
  Ok(r) => r,
  Err(err) => fail!(err)
};
{% endhighlight %}

---

We also return an owned pointer of `MappedRegion` if the function succeeded. We could've returned the instance by value, but we'll need to pass this around to multiple functions, so we want to reduce copying.

---


{% highlight rust %}
libc::PROT_READ | libc::PROT_WRITE
{% endhighlight %}

These flags are important. They define what protection/permissions the memory region has. We can now read and write to the memory region.

Remember that the contents of this safe function is wrapped within an `unsafe` block. This is needed to interop with naked, unsafe code.

<div class="message blue"><span><i class="fa fa-exclamation-circle"></i></span><div>Remember, it's much easier to understand and prove the correctness of one-thousand lines of completely unsafe code &mdash; which can be reasoned about &mdash; rather than hundreds of thousands of possibly unsafe, or even completely unsafe lines of code &mdash; that cannot be reasoned about.</div></div>

---

We can now create a new memory mapped region using safe interfaces. But, the memory doesn't have anything written to it yet. We'll use the `memcpy` function to copy the machine instructions to the memory region. Let's write a safe interface around the native function.

```rust
// src/safe.rs
...

pub fn memcpy(region: &MappedRegion, contents: &[u8]) {
    unsafe {
        raw::memcpy(
            region.addr as * c_void,
            contents.as_ptr() as *c_void,
            region.len as size_t);
        assert_eq!(*(contents.as_ptr()), *region.addr);
    }
}
```

---

We'll take a reference, or borrow a pointer to a `MappedRegion`.

```rust
region: &MappedRegion
```

Pass a reference, or a borrowed pointer to a vector of `u8`s.

```rust
contents: &[u8]
```

Again, we operate within an `unsafe` block. `memcpy` is practically like in C.

---

```rust
// src/safe.rs
...

pub fn mprotect(region: &MappedRegion, contents: &[u8]) {
    unsafe {
        if raw::mprotect(
            region.addr as *libc::c_void,
            contents.len() as libc::size_t,
            libc::PROT_READ | libc::PROT_EXEC
        ) == -1 {
            fail!("err: mprotect failed to protect
              the memory region.");
        }
    }
}
```

The last function we need to define, takes the same arguments as `memcpy`. This is how we transform the memory region to be read-only and executable, after we write to it.

---

Now we have `src/safe.rs`, `src/raw.rs`, and `src/region.rs` completed. We can now put these pieces together to make a functional JIT compiler.

Let's move onto our `src/main.rs` file.

We'll start by defining our crate:

```rust
// src/main.rs
#[crate_id = "jiter#0.0.1"];
#[desc = "Jiter"];
#[crate_type = "bin"];
#[license = "MIT"];
```

Include some modules we'll need:

```rust
// src/main.rs
...
use std::cast;
use region::MappedRegion;
```

Include some local modules:

```rust
// src/main.rs
...
mod raw;
mod region;
mod safe;
```

Before we go any further, let's go through the machine code we'll be generating. We're defining a function, because all JIT code needs to be wrapped in some sort of function, which can be called; that takes a single integer as it's only input, adds four to that integer, then returns that value. We'll be using the standard cdecl calling convention.

```asm
mov %rdi, %rax
add $4, %rax
ret
```

Which is compiled/encoded to:

```
0x48 0x89 0xf8       // mov %rdi, %rax
0x48 0x83 0xc0 0x04  // add $4, %rax
0xc3                 // ret
```

We can express the code using a vector within Rust.

```rust
let code = [
  0x48, 0x89, 0xf8,       // mov %rdi, %rax
  0x48, 0x83, 0xc0, 0x04, // add $4, %rax
  0xc3                    // ret
];
```

---

Let's define our `main` function.

```rust
// src/main.rs
...

fn main() {
  let code = [
    0x48, 0x89, 0xf8,       // mov %rdi, %rax
    0x48, 0x83, 0xc0, 0x04, // add $4, %rax
    0xc3                    // ret
  ];

  let region = match safe::mmap(code.len() as u64) {
      Ok(r) => r,
      Err(err) => fail!(err)
  };

  type AddFourFn = extern "C" fn(int) -> int;
  let Add = jit_func::<AddFourFn>(region, code);
  println!("Add(4): {}", Add(4));
}
```

Again, this was a previous example on using the safe mmap function. We'll assign the new `MappedRegion` to `region`.

```rust
// src/main.rs
...
let region = match safe::mmap(contents.len() as u64) {
    Ok(r) => r,
    Err(err) => fail!(err)
};
...
```

Rust is extremely good at interoperating with other runtimes, such as C. We'll define a basic function pointer that takes an `int` and returns an `int`. We're also defining this as a type, to make it easier to use.

```rust
// src/main.rs
...
type AddFourFn = extern "C" fn(int) -> int;
...
```

This is the magic bit. We haven't defined this function yet; we'll get to that next.

We'll pass our function pointer as a generic argument, along with the `code` (our encoded x86 instructions), and `region` which hold our mmapped memory block.

```rust
// src/main.rs
...
let Add = jit_func::<AddFourFn>(region, code);
...
```

Call the awesome function:

```rust
// src/main.rs
...
println!("Add(4): {}", Add(4)); // Add(4): 8
...
```

---

Let's define the `jit_func` function. This should be placed right before the `main` function.

```rust
// src/main.rs
...
fn jit_func<T>(region: &MappedRegion, contents: &[u8]) -> T {
    unsafe {
        safe::memcpy(region, contents);
        safe::mprotect(region, contents);
        assert_eq!(*(contents.as_ptr()), *region.addr);
        cast::transmute(region.addr)
    }
}

fn main() {...}
```

So, the basic steps are:

* `safe::memcpy`: Copy the instructions into the memory block.
* `safe::mprotect` Make the memory read-only, but executable.
* `assert_eq!(*(contents.as_ptr()), *region.addr);`: Ensure that the contents of the memory block is *exactly* the same as our vector.
* `cast::transmute(region.addr)`: We need to transform a raw pointer, which points to the beginning of the JIT function, to a C-style function pointer.

The `cast::transmute(region.addr)` will be casted against the specific JIT function type (which is a generic argument `T`). In this example, it's a function `extern "C" fn(int) -> int`.

---

Also, the reason we didn't put the `safe::mmap` call within the `jit_func` function is because we'd run into a segfault error while trying to execute our JITed function. That's because as soon as `jit_func` returns, our mmapped memory will be deallocated because the `MappedRegion` unique pointer will have gone out of scope.

A better way would be to split the functionality into many steps.

```rust
type AddFourFn = extern "C" fn(int) -> int;
let add = jit::func::<AddFourFn>();
add.emit_mov("%rdi", "%rax");
add.emit_add(4, "%rax");
add.emit_ret();
let addFn = add.getFunction();
addFn(4);
```

This would include having instruction encoding for various architectures and such.

Or, you could just use LLVM or LibJit. But, it's a good educational experience to learning, understanding, and implementing a JIT compiler.

You can view the [full source code on Github.](https://github.com/TheHydroImpulse/jiter)

---

[Follow me on Twitter](http://twitter.com/TheHydroImpulse)

[Github](http://github.com/TheHydroImpulse)

[1]: http://eli.thegreenplace.net/2013/10/17/getting-started-with-libjit-part-1/
[2]: http://llvm.org/
[3]: http://www.gnu.org/software/libjit/
[4]: https://github.com/mozilla/rust/blob/master/Makefile.in#L13
[5]: http://static.rust-lang.org/doc/master/tutorial.html#traits