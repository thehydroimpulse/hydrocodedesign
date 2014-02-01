---
layout: post
published: true
title: Using LLVM From Within Rust
---

Continuing with my previous writing theme about lower-level concepts from within Rust; we're going to get start using LLVM with Rust.

As I stated in my previous blog post, Rust is amazing with interoping with C and even C++, which is hard to come by. However, because LLVM is written in C++, it introduces the need to link against libc++ and create wrappers around C++'s classes and types.

Luckily &mdash; or maybe not, considering Rust's compiler is built using LLVM &mdash; we already have usable Rust bindings in-place. However, there's roughly no documentation on these bindings, except the source, and Rust's compiler, which has a lot more stuff going on than simple LLVM usage.

---

Now, the first order of operations is to link against `rustc`, the Rust compiler library. I'll also note that Rust is very good at handling this type of stuff, without adding any arguments to `rustc` &mdash; the compiler executable.

Let's begin to define our program. We'll create a new file called `bin.rs` and it's full path being `src/bin.rs`. This is standard Rust operations.

```rust
fn main() {

}
```

Because `rustc` (the library) is a dynamic library, sitting somewhere in your Rust installation directories, we'll need to tell Rust to find it.

```rust
extern mod rustc;

fn main() {}
```

This tells Rust that we want to link against an external module. However, depending on your installation, you might have multiple versions of Rust installed, or previous versions having leftover files on your system. We'll need to be explicit about which version we should link against.

```rust
extern mod rustc =  = "rustc#0.10-pre";

fn main() {}
```

I'm currently building against the master branch of Rust, so you can replace the version accordingly.

---

The main LLVM wrapping types are under `rustc::lib::llvm`. This include `ModuleRef`, `ContextRef`, etc... However, all the functions are defined under `rustc::lib::llvm::llvm`. Let's include some of those modules which will make things less verbose when calling any LLVM functions.

```rust
extern mod rustc =  = "rustc#0.10-pre";
use rustc::lib::llvm::llvm;

fn main() {}
```

Great! Now we'll need to fill out our `main` function. We'll first need to wrap everything under an `unsafe` block.

```rust
...
fn main() {
  unsafe {
    ...
  }
}
```

This isn't going to be an LLVM tutorial. You can find out how to use LLVM itself in it's respective documentation. All the docs will be using C++, so you'll have to do some work getting that translated over to Rust land.

---

We'll need three things created:

* Module
* Context
* Builder

We'll only create a single, global context, but you'd typically want to create multiple contexts if you'd need isolation between, say, multiple threads.

We won't be using the builder, so it's optional at this stage, unless you want to emit some useful LLVM IR.

```rust
extern mod rustc = "rustc#0.10-pre";

use rustc::lib::llvm::llvm;

fn main() {
    unsafe {
        // Create our first global context.
        let llvm_context = llvm::LLVMContextCreate();

        // Create our module `module1` and attach our context.
        let llvm_module = "mod1".with_c_str(|buf| {
            llvm::LLVMModuleCreateWithNameInContext(buf, llvm_context)
        });

        // Create a useless builder.
        let builder = llvm::LLVMCreateBuilderInContext(llvm_context);

        // Dump the output of the LLVM module in IR format.
        llvm::LLVMDumpModule(llvm_module);
    }
}
```

That's it. We can build the program with:

```
rustc src/bin.rs -o bin/rustllvm
```

Once running, you should have gotten the following output:

```
; ModuleID = 'mod1'
```

---

That's it! Pretty simple, eh?

You can check out [the full source code on github.](https://github.com/TheHydroImpulse/rust-llvm-example)