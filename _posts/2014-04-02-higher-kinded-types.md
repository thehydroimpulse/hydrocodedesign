---
layout: post
published: true
title: Higher-Kinded Polymorphism
---

Today I'm going to go through higher-kinded polymorphism, what it's uses are, and what it is (briefly). It's extremely fascinating, at least for me, to go through these relatively complex, highly-abstracted subjects.

---

Let's talk about types first, and specifically types that people are used to, for example `Int`, `String`, `Boolean`, etc... These are types we can use right away, they're values. These are also more formally called proper types.

Now that we can work with proper types, let's go further. Many (but not all) statically-typed languages have a form of generics. For example, `List<T>`, `Map<K,V>`, etc... Generics or type parameters, and type constructors (functions that construct other types) form the basis for further abstraction on-top of proper types.

Let's go through what `List<T>` *really* is. `List` is a type abstracting over a type `T`. This is called a type constructor; given a type `T`, we construct type `List<T>`. Moreover, it should be clear that `List<T>` is *not* a proper type. That is, it's not a concrete type &mdash; it needs a parameter to be passed before the useable type can be formed. That's the type constructor's job. `List<Int>`, however, *is* a concrete type; it's finished &mdash; we've passed the appropriate type parameters.

How can we distinguish this type constructor from proper types? Because it's a type abstracting over another (proper) type. This is called first-order types; because we only abstract over a type once.

Using a more formal syntax for defining kinds of types, we can say a proper type is of `*`; whereas a first-ordered type is of `* -> *` and `* -> * -> *`.

Let's go through `* -> *`. It means, given a type, produce another type. That's exactly what the type constructor is. We can further visualize it as: `T -> List<Int>`. The next form `* -> * -> *` is almost the same thing. You can think of it as: given two pairs of types, produce a third type. Thus, `* -> * ...` in the context of `* -> * -> *` is the pair of types. A common example is a simple key-value map: `Map<K,V>` is of the form `* -> * -> *`.

This is all great. We're able to express more abstract types, such as `Map<K,V>`, `List<T>`, etc... and void repetition. But, what if we could abstract further. Imagine a type `Foo` that takes type `M` &mdash; `Foo<M>`. But, what if `M` is a type constructor?

---

That's where higher-kinded polymorphism come into play. Instead of having a type parameter that's of a proper type (like in the case of `List<T>`; where `T` is a proper type.), we have the type parameter be a type constructor. Thus, we require a type that will itself produce another type. Alternatively, we can say: a type that abstracts over a type that abstracts over a type. Very much abstracted. That's a higher-kinded type.

Thus, the form is: `(* -> *) -> *` where `(* -> *)` is a type constructor. We also call these second-order types. For types greater than first-order, we call them *higher-kinded*.

Following, say, Rust, we could have:

```rust
trait Higher<M<_>> {
	// ...
}
```

That's if we follow the currently defined syntax for generics. However, I feel like the following (used only for defining higher-order types) feels a lot more natural:

```rust
trait Higher<M[_]> {
	// ...
}
```

The square brackets would perform the same function as the angle brackets, but would be used in a higher-order type context.

Now, the `_` is simply a forgetter symbol (we don't want to deal with that type, so just infer and forget). Thus, we could have done `M[X]`, instead; but, often times, you don't care about that type parameter.

---

Now that we got through higher-kinded polymorphism, let's go through it's uses.

You may have heard of terms such as Monads, Monoids, Functors, Semigroups, etc... These are all fairly popular in functional languages, some terms more so than others. These are all represented as higher-kinded types.

Almost every aggregation problem can be represented as Monoids. For example, HyperLogLog is a monoid. HyperLogLog is actually a composition of monoids, because it contains operations such as Min, which is also a monoid.

Monoids are an *extremely* powerful primitive, as well as Monads, Functors, etc...

All of these come from abstract algebra and category theory, which is a pretty insane field.

----

### How Does This Relate To Rust?

We'll, Rust currently doesn't support higher-kinded polymorphism. But, I'm in the process of writing up an RFC for it and experimenting with various implementations.

Within Rust, you typically use a lot of `Option<T>` and `Result<T>`, and may end up with quite a bit of pattern matching pyramids. This can get quite crazy and messy.

Luckily, Monads are the perfect tool for the job. Haskell uses them extensively for working with their equivalent option type and it reduces the ugliness quite a bit.

For the most part, most of these concepts are almost strictly exclusive in functional languages like Scala or Haskell (You can hack yourself some Monads with lots of C++ templates, if you wish), but imagine having these powerful primitives in a *systems* language!

I'll be following up on this blog post the focuses on proper examples, specifically for Rust, and the advantages of it.

Resources:

* [Generics of a Higher Kind](http://adriaanm.github.io/files/higher.pdf) (Scala reference paper)


[Reddit thread within the Rust subreddit](http://www.reddit.com/r/rust/comments/2212j2/higherkinded_polymorphism/)