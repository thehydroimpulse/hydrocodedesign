---
title: "The Effects of Higher-Kinded Polymorphism"
layout: post
published: false
---

After I had posted the first article on [higher-kinded polymorphism](/2014/04/02/higher-kinded-types/), it seems people are particularly intrigued by them within the [Rust](http://rust-lang.org) community &mdash; The [#rust IRC channel](https://botbot.me/mozilla/rust/) gets the question *"Does Rust have HKTs?"*, or a conversation about HKTs fairly often.

I didn't really have any particular goals before writing that last article. It simply came out randomly. Obviously that resulted in many things being missed or not really explaining the effects of such a concept. Maybe I explained *what* they are, but you really need to get the full picture. Otherwise, you start questioning it's validity, or worse, that "it's just for academia and not useful elsewhere". Rust has showed us that learning from the programming language theory community is a *good idea*, not a bad one.

Rust has decided to lean towards a stronger type system to provide some of it's guarantees. Ownership, and optional types are examples. However, not only is `Option` hard to work with (and very verbose at times), the implementation for `Result` and `Option`, even though they share a good set of functionality, have been duplicated. That's not good.

To handle the first case, where working with `Option` can be a pain, you could go with the Swift route and simply add some syntax sugar. This is fine, but once again, it's just sugar. The worst part of all? It's only for *that* type &mdash; hard-coded into the compiler. That's not really cool, especially for Rust where extensibility is a corner-stone of the language. You might be able to give sugar to one idiom, but what about everything else?

What other options do we have then? We'll, we really only have one option, and that requires us to introduce higher-kinded polymorphism.

**tl;dr**: Abstracting over proper types like `int`, `String`, etc... are standard in most statically-typed programming languages in the form of generics. However, they present the limitation of only being able to abstract over those simple, proper types. What if we wanted to abstract over `Vec<T>`? For all `T`s? We can't currently do that in Rust, but that's what higher-kinded types support.

## Introduction to Higher-Kinded Types

Let's dive right into how we can abstract over more than proper types. Let's define a simple `Simple` type that works on type-constructors like `Option`, `Vec`, etc...

```rust
trait Simple<A> {
    fn something<B>(&mut self, f: |A| -> Self<B>) -> Self<B>;
}
```

As you can see, `Self` is a type constructor. It accepts it's own type parameter. `Self` could be an `Option`, `Vec`, etc...

---
I'll side-step just a little bit here. Often times when we're talking about higher-kinded types, we talk about *kinds* instead of simply types. I'm proposing the compiler would do kind-inference globally, yet disallow kind syntax. This is basically what Scala does, however, Scala has limited inference capabilities, so the inference would be inlined with Haskell, but without explicit syntax for it.

I'll be following up with a lot more detail on the inner workings of the inference and how that would effect everything else. It's simply out of scope for this article.

---


Given our previous `Simple` type, we can easily implement this:

```rust
impl<A> Simple<A> for Vec<A> {
    fn something<B>(&mut self, f: |A| -> Vec<B>) -> Vec<B> {
        // ...
    }
}
```

Again, the syntax is extremely minimal. The significant change would be within the compiler for it to understand *kinds* and infer it across types. This simplifies the user's workload in that it's dead simple to work with.

## Mappings

Let's talk about a fairly easy concept. Traditionally with lists, we have a standard function for mapping over each element `map`. However, are lists really the only type that can be mapped over? Can `Option` be mapped over?

Yes, yes it can. In fact, any container of sorts can be mapped over, even empty lists!

We can define a universal method for mapping over types: `fmap`.

```rust
// ...
fn fmap<A, B>(&self, f: |A| -> B) -> Self<B>;
// ...
```

`fmap` takes a closure that takes a value of type `A` and returns a value of type `B`. `fmap` then returns a `Self<B>`, which `B` is the same type returned by the closure.


## Option

Ok, so let's really get into how we can make the `Option` type more workable. Let's see an example of doing a series of computations using `Option`s, which currently, you can't compose at all!

```rust
fn action1() -> Option<int> {
    // ...
}

fn action2() -> Option<int> {
    // ...
}

fn action3(a: int, b: int) -> Option<String> {
    // ...
}
```

Ok, so these are our computations. `action3` has dependencies on the values potentially computed by `action1` and `action2`. The current way of handling this would be pattern matching.

```rust
match (action1(), action2()) {
    (Some(a), Some(b)) => {
        match action3(a, b) {
            Some(s) => {}, // Success
            None => {} // Failure
        }
    },
    _ => {} // Failure
}
```

Not the prettiest of code. It's quite cryptic and a few levels of needless indentations. Try adding some more complex dependencies between the computations or try adding another couple of computations in this pipeline. This is a very tedious and error prone arrangement.

## Monads

Well, an `Option` type is [actually just a monad](http://learnyouahaskell.com/a-fistful-of-monads).

* A monad is a structure that represents computations defined as sequences of steps conforming to a set of laws.
* Monads require higher-kinded types.

Remember the previous example of a series of computations? That's what it is. I should also add that people make monads a whole lot more alien and complicated voodoo than is required. A monad builds on a few other constructs such as [`Functor` and `Applicative`](http://learnyouahaskell.com/functors-applicative-functors-and-monoids). We'll go back to those in this article.

A monad trait can be fully defined as:

```rust
trait Monad<A> {
    /// This is analogous to Haskell's `return` method. It
    /// takes a pure value of type `A` and wraps it in a context
    /// of `Self`.
    ///
    /// Example:
    /// ```rust
    /// option.pure(5i); // Some(5i);
    /// ```
    fn pure(&self, val: A) -> Self<A>;
    /// Take a closure that accepts a value of type `A`
    /// and returns a value `B` wrapped in a context of `Self`.
    fn bind<B>(&self, f: |A| -> Self<B>) -> Self<B>;
}
```

In the case of the `pure` method, this should really be one that *doesn't take `&self`* such that you could write: `Option::pure(5i)` which makes a lot more sense. Alas, this is currently not possible in Rust.

We can now easily implement the monad trait for the option type:

```rust
impl<A> Monad<A> for Option<A> {
    fn pure(&self, val: A) -> Option<A> {
        Some(val)
    }

    fn bind<B>(&self, f: |A| -> Option<B>) -> Option<B> {
        if self.is_none() { return None; }
        f(self.unwrap())
    }
}
```

Now, monads are great! They let us define a common interface for all types that satisfy the monad law. However, they still have some syntactical noise we have to deal with. Haskell solved this issue by introducing the do sugar, where it removes the level of indentations brought by the closures. We can do the exact same thing, except we can introduce a do macro and not a compiler-implemented construct.

```rust
do! {
    let a <- action1();
    let a <- action2();
    action3(a, b);
}
```

That's the *same* example as previously shown, but it's **a lot simpler**, more concise, and it's overall better.

Let's break this down.

1. We're introducing a new macro `do! {}`. That's pretty standard stuff, eh?
2. We're binding a new variable `a`, but, uhh, what the heck is `<-` doing there? Well, we want to pipe the monadic value across the pipeline instead of just using the returned value.
3. We do the same thing for `b`.
4. We're just calling a function with the two monadic values `a` and `b`.

This would result in the ability to compose `Option` types much like we currently do with `Result`, except we're establishing a more fundamental abstraction.

It's also quite similar to the Haskell's do notation:

```haskell
do a <- action1
   b <- action2
   action3 a b
```

Behind the scenes, both of these examples translate into their bind alternatives (We could rename bind to the `and_then` variant).

## Composability

All the previous examples were demonstrated via function calls. But, this isn't a requirement. The right-hand side of the `<-` symbol is simply an expression. You could very well have:

```rust
let r = do! (
    let a <- Some(55i);
    let b <- Some(12i);
    Some(a * b);
);
```

Nothing special here.

This allows you to compose them extremely effectively.

```rust
fn do_something(a: int, b: int, c: int) -> Option<String> {
    do! (
        ret <- Some(a * b * c);
        Some("Foobar".to_string())
    )
}

fn compute(a: int, b: int) -> Option<int> {
    do! (
        c <- Some(50i);
        do_something(a, b, c);
    )
}
```

## Overall Benefits

Pattern matching is used *a lot*. Option types are also used *a lot*. Because pattern matching is currently the only way to deal with options, it has an extra level of use.

With the `do!` macro, along with a proper `Monad` trait and implementations (`Option` is simply *one* example of a monad), we could cut down on a lot of noise and verbosity.
