---
title: "Practicality With Rust: Error Handling"
published: true
layout: post
---

<div class="series">
    <span>The Series:</span>
    <ul>
        <li>
            <a href="../../../../2014/04/24/practicality-with-rust/">Setting Up A Project</a>
        </li>
        <li>
            Error Handling
        </li>
    </ul>
</div>

---

When learning a new language, error handling is often a concept that's being questioned. How does error handling work? Is there exceptions? Is it verbose? etc...

Let's go through Rust's error handling situation and how we can take advantage of it.

Rust **doesn't have exceptions**.

Ok, now that we got that out of the way, let us see what Rust does have.

Rust has tasks, where these tasks can be used as native threads (1:1), or green threads (M:N).

Tasks are the fundamental unit of containment within Rust programs. Instead of trying to catch an exception and *try* to repair the current state, you can just kill the task, and restart.

Besides, considering Rust is a systems language, exceptions and stack unwinding are unacceptable.

In languages like C and Go, you might barely use a type system to work with errors. For example, a boolean, an integer, C enum, etc... Rust, on the other hand, has a more sophisticated type system that we can take advantage of.

`Result` is the standard type when working with results of operations. These can be I/O, computation, etc... They all work the same way.

[Result](http://static.rust-lang.org/doc/master/core/result/type.Result.html) is just an [algebraic data type](https://en.wikipedia.org/wiki/Algebraic_data_type) (Rust enum) that has two options: `Ok(T)` and `Err(E)`. Those are the two variants that `Result` provides.

Let's define a function that could produce an error:

```rust
fn do_something(input: &str) -> Result<(), String> {
    if input != "foobar" {
        Err("input doesn't match 'foobar'.".to_string())
    } else {
        Ok(())
    }
}
```

This is just a simple example.

One question that you should ask yourself is: "*When the function is successful, do I need to return any data back to the user?*"

If the answer is no, then you would just return an empty tuple `()`. Otherwise, you can return whatever you want.

While having error strings are *fine* in some languages, they're not the most ideal way of doing things. One of Rust's more powerful feature is pattern matching and by using strings we lose that ability. That's not good, so let's make use of it by working with enum types.

I'll dump some code here and I'll go over everything after:

```rust
use std::str::SendStr;

type ProgramResult<T> = Result<T, ProgramError>;

#[deriving(Show)]
struct ProgramError {
    kind: ProgramErrorKind,
    message: SendStr
}

/// The kinds of errors that can happen in our program.
/// We'll be able to pattern match against these.
#[deriving(Show)]
enum ProgramErrorKind {
    Other
}

impl ProgramError {
    pub fn new<T: IntoMaybeOwned<'static>>(msg: T, kind: ProgramErrorKind) -> ProgramError {
        ProgramError {
            kind: kind,
            message: msg.into_maybe_owned()
        }
    }
}

fn do_something(input: &str) -> ProgramResult<()> {
    if input == "foobar" {
        Err(ProgramError::new("input doesn't match 'foobar'.", Other)
    } else {
        Ok(())
    }
}

fn main() {
    match do_something("foobarnope") {
        Ok(_) => {},
        Err(e) => fail!("{}", e)
    }
}
```

Let's go through this one piece at a time.

```rust
#[deriving(Show)]
struct ProgramError {
    kind: ProgramErrorKind,
    message: SendStr
}
```

Here, we'll define our new error type. Now, you would have a single (depending on your program) error type that you would use. You wouldn't need to create multiple per project, just one. You can also add additional fields to the struct to accommodate your needs. We have the `kind` field which holds all possible error kinds. This allows us to pattern match against them. If your program can produce new error kinds, you can add them to that enum.

```rust
type ProgramResult<T> = Result<T, ProgramError>;
```

Instead of repeating ourselves throughout our codebase with `Result<T, ProgramError>`, we'll just create a type alias. Again, we use Rust's sophisticated type system to our advantage.

Note: You'll probably want to rename `Program` to the actual name of your program/library.

---

## Handling Errors

Ok, so we can create sophisticated errors, but how do we handle them?

Let's focus on the manual process: pattern matching:

```rust
match do_something("foobar") {
    Ok(_) => {},
    Err(e) => fail!("{}", e)
}
```

This is quite verbose and has an explicit `fail!` in there. You want to try and have as little side-effects as possible &mdash; and failing is a huge one. We'll want to leave that to a broader function, perhaps.

If the broader function also returns a `ProgramResult`, then we can use the nifty `try!` macro:

```rust
fn do_many_things() -> ProgramResult<()> {
	try!(do_something("foobar"));
}
```

`try!` is not magic, it just expands to:

```rust
match $e {
	Ok(e) => e,
	Err(e) => return Err(e)
}
```

So, it'll return the function with the error if one exists, otherwise it'll return the contents of the `Ok` variant. That allows one to do:

```rust
fn do_many_things() -> ProgramResult<()> {
	let foobar = try!(program("{hello world}"));
}
```

## Working With Other Errors

An issue with the approach above is when working with `IoError`s. In addition to using `try!`, we'll need to convert an `IoError` to a `ProgramError`.

We first need to add a variant to the `ProgramErrorKind`:

```rust
enum ProgramErrorKind {
    Empty,
    IoError(std::io::IoError)
}
```

Now we can convert between the two:

```rust
fn to_program(io: std::io::IoError) -> ProgramError {
	ProgramError::new(io.desc.into_maybe_owned(), IoError(io))
}
```

Here's a function that uses an I/O function (thus working with `IoError`) and `ProgramError`.

```rust
fn from_file(path: &Path) -> ProgramResult<()> {
	let file = try!(File::open(path).read_to_str().map_err(to_program));
	try!(do_something(file.as_str()));
	Ok(())
}
```


## Failing

Tasks in Rust can fail. Rust follows along the lines of Erlang in that instead of trying to patch the state during a failure &mdash; and hoping you can continue &mdash; *just fail the task and restart*. It's as simple as that. This is also a common practice among fault-tolerant, distributed systems (e.g., Storm) where trying to repair a node is simply too error prone &mdash; crash it, then restart.

You can force a task to fail through the `fail!` macro.

```rust
spawn(proc() {
    fail!("Ooppps!")
});
```

## Overview

* Use custom error types. Please don't use integers (a la `-1`) or strings.
* Each project can have it's own error and result types based on it's needs.
* Use the `try!` macro as much as you can.
* Avoid explicitly failing a task where it's not appropriate. A function should have minimal side-effects.
* If a task cannot continue (it hit an error, for example), then kill it and restart the task.
* Use methods on results like `map_err` to convert between different error types.
* Avoid using `unwrap`, because it can fail.

## More Examples!

Examples are great! I'm currently working on a [gossip protocol "Gossip.rs"](https://github.com/TheHydroImpulse/gossip.rs/) that uses the practices above. Specifically, [`GossipResult` and `GossipError`](https://github.com/TheHydroImpulse/gossip.rs/blob/671f007d9db734545c9aae159899c1822d1ae354/src/gossip/util.rs) types.

## Community

What else does the community think of in terms of error handling in Rust? Are there any more patterns and tips? I'd love to hear them.

If you'd like me to focus on specific subjects for the next article in the series, let me know on Reddit or in the comments.

---

```bash
$ rustc -v
rustc 0.11.0-pre-nightly (25951b2 2014-05-30 00:31:44 -0700)
host: x86_64-apple-darwin
```
