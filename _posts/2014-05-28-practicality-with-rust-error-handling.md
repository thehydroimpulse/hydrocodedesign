---
title: "Practicality With Rust: Error Handling"
published: true
layout: post
---

<div>
    The Series:
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
/// Take an input, and make sure that '{' is at the
/// beginning (0th position) and '}' is at the end.
fn parse(input: &str) -> Result<(), String> {

	// Create a new iterator of chars.
    let mut chars = input.chars();
    let mut done  = false;

    if input.len() == 0 {
        return Err("Invalid Syntax: Empty string was
        		passed.".to_string());
    }

    if chars.next().unwrap() != '{' {
        return Err("Invalid Syntax: Expected '{' to be at
        		position 0.".to_string());
    }

    chars.next().while_some(|ch| {
        if ch != '}' {

        } else {
            done = true;
            return None
        }

        chars.next()
    });

    if !done {
        return Err("Invalid Syntax: Expected '}' to be at the
        		end of the input.".to_string());
    }

    Ok(())
}
```

This is just a simple parsing example. We can either successfully parse the contents of the slice, or return an error.

One question that you should ask yourself is: "*When the function is successful, do I need to return any data back to the user?*"

If the answer is no, then you would just return an empty tuple `()`. Otherwise, you can return whatever you want.

While having error strings are *fine* in some languages, they're not the most ideal way of doing things. One of Rust's more powerful feature is pattern matching and by using strings we lose that ability. That's not good, so let's make use of it by working with enum types.

I'll dump some code here and I'll go over everything after:

```rust
use std::fmt::{Show,Formatter};
use std::fmt;

/// Create a new ParseResult to wrap our ParseError.
/// This allows us to work with a single type throughout
/// our program.
type ParseResult<T> = Result<T, ParseError>;

#[deriving(Show)]
struct ParseError {
    kind: ParseErrorKind,
    message: ErrorMessage
}

/// Allow messages to be a static slice or a boxed string.
#[deriving(Show)]
enum ErrorMessage {
    StringMessage(String),
    StaticMessage(&'static str)
}

/// The kinds of errors that can happen in our program.
/// We'll be able to pattern match against these.
enum ParseErrorKind {
    Empty,
    InvalidSyntax(uint)
}

impl ParseError {
    pub fn new<T: Show>(msg: T, kind: ParseErrorKind) -> ParseError {
        ParseError {
            kind: kind,
            message: StringMessage(msg.to_str())
        }
    }
}

/// Add the ability to print out the message kind. This will allow
/// us to have nicely formatted messages.
impl Show for ParseErrorKind {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            &Empty => write!(f, "Empty Input: "),
            &InvalidSyntax(pos) => write!(f, "Invalid
                Syntax at {}: ", pos),
            _ => write!(f, "Other")
        }
    }
}

/// Parse an input string hopefully containing '{...}'.
fn parse(input: &str) -> ParseResult<()> {
    // Create a new iterator containing chars.
    let mut chars = input.chars();
    let mut done  = false;

    if chars.next().unwrap() != '{' {
        return Err(ParseError::new("Expected '{' to
            be first.", InvalidSyntax(1)));
    }

    chars.next().while_some(|ch| {
        if ch != '}' {

        } else {
            done = true;
            return None
        }

        chars.next()
    });

    if !done {
        return Err(ParseError::new("Expected '}'
            to be last.", InvalidSyntax(input.len())));
    }

    Ok(())
}


fn main() {
    match parse("{foobar}") {
        Ok(_) => {},
        Err(e) => fail!("{}", e)
    }
}
```


Let's go through this one piece at a time.

```rust
#[deriving(Show)]
struct ParseError {
    kind: ParseErrorKind,
    message: ErrorMessage
}
```

Here, we'll define our new error type. Now, you would have a single (depending on your program) error type that you would use. You wouldn't need to create multiple per project, just one time. You can add additional fields to the struct to accommodate your needs. We have the `kind` field which holds all possible error kinds. This allows us to pattern match against them. If your program can produce new error kinds, you can add them to that enum. The message is simply a way to work with both statically allocated strings (which are common for error messages) and boxed strings. This way we can support both through `StaticMessage("blah blah")` and `StringMessage("blah blah 123".to_string())`.

```rust
type ParseResult<T> = Result<T, ParseError>;
```

Instead of repeating ourselves throughout our codebase with `Result<T, ParseError>`, we'll just create a type alias. Again, we use Rust's sophisticated type system to our advantage.

---

## Handling Errors

Ok, so we can create sophisticated errors, but how do we handle them?

Let's focus on the manual process: pattern matching:

```rust
match parse("{foobar}") {
    Ok(_) => {},
    Err(e) => fail!("{}", e)
}
```

This is quite verbose and has an explicit `fail!` in there. In our parsing example, we definitely don't want to `fail!`. That's not the appropriate place to do so. You want to try and have as little side-effects as possible &mdash; and failing is a huge one. We'll want to leave that to a broader function, perhaps.

If the broader function also returns a `ParseResult`, then we can use the nifty `try!` macro:

```rust
fn do_parse() -> ParseResult<()> {
	try!(parse("{hello world}"));
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
fn do_parse() -> ParseResult<()> {
	let foobar = try!(parse("{hello world}"));
}
```

## Working With Other Errors

An issue with the approach above is when working with `IoError`s. In addition to using `try!`, we'll need to convert an `IoError` to a `ParseError`.

We first need to add a variant to the `ParseErrorKind`:

```rust
/// The kinds of errors that can happen in our program.
/// We'll be able to pattern match against these.
enum ParseErrorKind {
    Empty,
    InvalidSyntax(uint),
    IoError(std::io::IoError)
}
```

Now we can convert between the two:

```rust
fn to_parse(io: std::io::IoError) -> ParseError {
	ParseError::new(StaticMessage(io.desc), IoError(io))
}
```

Here's a function that uses an I/O function (thus working with `IoError`) and `ParseError`.

```rust
fn from_file(path: &Path) -> ParseResult<()> {
	let file = try!(File::open(path).read_to_str().map_err(to_parse));
	try!(parse(file.as_str()));
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