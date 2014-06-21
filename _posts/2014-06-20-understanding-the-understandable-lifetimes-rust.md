---
title: "Understanding The Understandable: Lifetimes in Rust"
published: false
layout: post
---

<img src="/public/img/vines.jpg" class="poster" />

Lifetimes: A common concept that seems vastly more complicated than they actually are.

After reading this article, you should:

* have an excellent understanding of lifetimes!
* be able to express lifetimes in Rust!

Those are two worthy goals.

## The Stack and Heap

In Rust, we can make two allocations normally: on the stack and on the heap. On some CPU architectures (like x86), the stack is extremely optimized and a much more efficient data structure than the heap. However, the stack is very limited in terms of size (i.e., you can't store large data in it) and how it's used.

## How Functions Work

By understanding how functions work (and how it uses the stack), we'll have a much better foundation for discussing lifetimes.

Given the following function:

```rust
fn add(a: int, b: int) -> int {
  a + b
}
```

How would this function be called?

1. We establish a stack-frame, almost like an isolation unit to contain one function from another. This let's functions act independently of it's location on the stack.
1. We first push the parameters onto the stack.

---

```bash
$ rustc -v
rustc 0.11.0-pre-nightly (feb294c 2014-06-17 08:16:27 +0000)
host: x86_64-apple-darwin
```

