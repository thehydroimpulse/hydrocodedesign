---
title: "Understanding The Understandable: Lifetimes in Rust"
published: true
layout: post
---

<img src="/public/img/vines.jpg" class="poster" />

Lifetimes: A common concept that seems vastly more complicated than they actually are.

After reading this article, you should:

* have an excellent understanding of lifetimes!
* be able to express lifetimes in Rust!

Those are two worthy goals.

## Records

Let's talk about records before we dive elsewhere. A record is a more formal word (read: fancy) used to describe "objects" or data (but it doesn't have any other associations to it. Like Object oriented programming has with "objects"). It's just data in some form of structure. Any program has a lot of these and we'll need a way to reason about them without resorting to a garbage collector.

## Vines

Let's talk about vines, like in the image above. Most of them are going in arbitrary directions and interleaving with other vines. Each vine has a different length and size, resulting in a complex relationship. Some are dying and others are growing.

We can just replace the word "vine" with "record" and we have lifetimes. Ok, so let's say that different records have different *lifetimes* (read: durations until they die) from each other.

## Lifetimes

<img src="/public/img/lifetime.png" class="poster" />

Ok, so we have 3 objects: `Object1`, `Object2`, `Object3`. Each of those smaller lines are lifetimes. The blue line, under `entry`, is called the *program lifetime*. This can also be called the *static lifetime*, meaning, objects with this lifetime have to live as long as the program itself.


```rust
fn main() { // static lifetime.
    { // Lifetime 1
        let object1 = &1;

        { // Lifetime 3
            let object3 = &3;
        }
    }

    { // Lifetime 2
        let object2 = &2;
    }
}
```

So, the lifetimes of objects describe their duration (from the time they are created to when they are freed). While I did put the static lifetime to begin when `main()` is called, this isn't completely true. You can have static lifetimes for objects that are defined before main.

As you can see, Rust has blocks `{}` to denote scope.

```rust
static foo: &'static str = "This string will live as long as the program does.";

fn main() {
  // ...
}
```

## What's The Big Deal?

Well, most languages, like those that have a garbage collector (C#, Java, JavaScript, etc..), hide the details of lifetimes. Garbage collectors would effectively ensure that all lifetimes are correct and records are cleaned up appropriately, even with insanely complicated interwoven dependencies.

Languages without GC &mdash; like C and C++ &mdash; do not hide this detail. However, they don't provide first-class support for expressing lifetimes, either. This leads to programmers having to manage lifetimes in their heads and through conventions. This makes it extremely easy to make mistakes and result with incorrect lifetimes and potentially leaking bugs (memory leaks, double free, null pointer dereference, etc...).

Rust also *doesn't have a garbage collector*, but it doesn't resort to memory-unsafe constructs like C or C++. Rust provides first-class support for lifetimes where the compiler can officially infer and validate the lifetimes of objects. However, Rust doesn't have program-wide inference and there are many situations where the user has more appropriate knowledge of the lifetimes than the compiler does. The compiler will still ensure the lifetimes match up, because it *has* to retain safety without resorting to a GC.

The ability for users to denote the lifetime of objects is called having *named lifetimes*. Named lifetimes are placed right beside type parameters (convention is to put lifetimes first) in the `<>` form and all begin with a single quote `'` followed by a single letter name; such as `'a`, `'b`, `'c`, etc... The only exception to this rule is built-in lifetimes such as `'static`.

You're probably asking why we use cryptic, single letter names, instead of something more descriptive, right? Well, you *can't* actually be more descriptive other than a simple enumeration. If you have two lifetimes, are you going to call them `'lifetime_that_does_b` and `'lifetime_for_struct_c`? Definitely not. That's way too verbose and doesn't give that much benefit in the end (not to mention more mental effort on the part of the user to come up with unique names).

## Creating A Named Lifetime

A very useful result out of being able to express lifetimes is the ability to store an unboxed string within structs. By unboxed, I mean it's stored onto the stack, which becomes a problem in C or C++ &mdash; if the stack frame that the string was created under has a shorter lifetime than the string itself, the reference may be pointing to some invalid memory and potentially crash. That's not the case in Rust.

Let's try to use a regular string slice (`&str`) and store it within some record:

```rust

struct Execution {
  command: &str
}

fn main() {
  let exec = Execution { command: "foobar" };
}
```

The compiler will indeed throw an error because we're missing a lifetime (i.e., the compiler has no guarantees for how long the string is alive for and thus won't compile).

```
<anon>:3:12: 3:16 error: missing lifetime specifier
<anon>:3   command: &str
                    ^~~~
error: aborting due to previous error
```

We'll need to first create a new named lifetime that we could apply to the string. This is done with the same syntax as type parameters.

```rust
// Notice the `'a`?
struct Execution<'a> {
  command: &str
}

fn main() {
  let exec = Execution { command: "foobar" };
}
```

Nothing has in-fact changed. The compiler will continue to scream at you and that's ok. In the code above, we just introduced a new named lifetime of `'a`. Now we can use it!

```rust
// Notice the `'a`?
struct Execution<'a> {
  command: &'a str
}

fn main() {
  let exec = Execution { command: "foobar" };
}
```

Ta-da! We have successfully created and used a lifetime. Moreover, *Rust isn't even using a garbage collector* and we don't have any messy (and unsafe) allocation code all over the place.

## One More

Let's get another example going, a perhaps more complicated example. This should give you the skills required to apply lifetimes in your own Rust programs.

Let's create a `Parser` struct that contains a `Chars` iterator to, well, iterate over characters from a string.

```rust
use std::str::Chars;

struct Parser {
    iter: Chars
}

impl Parser {
    pub fn new(input: &str) -> Parser {
        Parser {
            iter: input.chars()
        }
    }
}
```

ughh... Once again, the compiler screams at you. Not again, right?

```
error: main function not found
<anon>:4:11: 4:16 error: wrong number of lifetime parameters: expected 1 but found 0
<anon>:4     iter: Chars
                   ^~~~~
```

Ok, so I guess `Chars` requires a lifetime and we haven't passed on, right? Yep, so let's do that.

```rust
struct Parser<'a> {
    iter: Chars<'a>
}
```

That's how you pass a lifetime through another type. Pretty consistent. But, like type parameters, we need to add the lifetime to the `impl` syntax.

```rust
impl<'a> Parser<'a> {
    pub fn new(input: &'a str) -> Parser<'a> {
        Parser {
            iter: input.chars()
        }
    }
}
```

That's it! So, what have we done?

* `impl<'a>`: Create a new named lifetime for the `impl` block.
* `Parser<'a>`: The parser type also requires a lifetime, so we'll pass it the one we created.
* `input: &'a str`: This tells the compiler that the lifetime is bound to that string.
* `-> Parser<'a>`: Again, we need to pass the lifetime to match the requirements.

At first, this might look verbose, busy, and perhaps needlessly complicated. I can assure you that it becomes super simple.

## And?

This is *one* of the reasons that Rust doesn't need a garbage collector to remain memory safe. It also allows us to use the stack much more effectively and lay off the heap until we really need it. Today, there's simply too much heap allocations happening because of languages like Java where objects were naturally heap allocated. Current CPU architectures are extremely optimized for stack allocations, so we should use them &mdash; and Rust allows you to.

## Precedence

Lifetimes aren't actually new. First-class support for them in compilers are. Whereas before, you had to reason about *all* the lifetimes in a given project *without* proof that they are correct and safe.

---

```bash
$ rustc -v
rustc 0.11.0-pre-nightly (feb294c 2014-06-17 08:16:27 +0000)
host: x86_64-apple-darwin
```
