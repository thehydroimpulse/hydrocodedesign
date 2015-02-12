---
title: "Writting PostgreSQL Extensions in Rust"
layout: post
published: true
---

<img width="300" style="display: block; margin: 0 auto" src="/public/img/postgres.png" class="poster" />

Recently, I've been focusing a lot of effort in lower-level areas in using Rust such as embedded systems, device drivers, C FFI, etc... After I read a post in which someone wrote a [Postgres extension to improve performance by vectorizing the execution](https://github.com/citusdata/postgres_vectorization_test), it lead me to wonder "How well could Rust do this?". After looking at the code for the extension, which is written in C, I noticed how ad-hoc the API was. Allocations were somewhat different from traditional `malloc/free`, a slew of ad-hoc macros for doing mostly everything (from argument handling to return types) and a completely different data model to work with &mdash; a datum what?

So I went ahead a released a Rust library [postgres-extension.rs](https://github.com/thehydroimpulse/postgres-extension.rs) that aims at allowing one to build something like the vectorization extension in Rust. The applications and advantages are real and previous examples of how [Rust's lifetimes are able to solve previous problems](https://blog.mozilla.org/research/2014/08/26/javascript-servos-only-garbage-collector/) that were impossible in C++.

## Memory Regions

Postgres has a slew of different data types, some taken by value, others by reference, etc... Postgres also has it's own memory allocator `pg_malloc` and `pg_free`. Why not use `malloc` and `free`? Well, a database by nature has to be long-living. Having a single memory leak in a production database is pretty serious. When using `malloc` and `free`, you inherently enter a contract on how you're supposed to go about using that memory and cleaning it up. This leaves the task of cleanup up to the programmer, and we all know where this leads to. Postgres instead tries to solve this issue by using a region allocator &mdash; something akin to Rust's lifetimes.

Before each invocation of procedures, a call to `SPI_connect` is made that establishes a new region, or a new *lifetime*. At the end, the opposite call to `SPI_finish` is made, cleaning up the memory that was allocated within that region. Any calls to `pg_malloc` is done in the *current* region.

The only exception to this case of allocating into the current region is when you want to return values from the procedure. If you just allocate memory with the regular `pg_malloc`, the region will be invalidated when anything tries to read the return value, resulting in memory safety issues. The solution is to allocate to the direct parent region using `SPI_palloc`.

Well that's an extremely clever solution and matches with Rust's semantics pretty well, so let's try and map this out in Rust.


```rust
/// A pointer to an object in heap-allocated memory with a specific
/// lifetime of 'a that correspond to the current region 'a such that a `Ref<'b>` <: `Ref<'a>`
/// which means that the lifetime of 'b is a subtype of that of lifetime of 'a and can be
/// used interchangeably.
pub struct Ref<'a, T> {
    ptr: *mut T
}
```

Let's illustrate an example of how this could be used effectively:

```rust
// Note: This isn't Rust code, it's just pseudo code.

// Establish a new region for the lifetime of 'a
SPI_connect();

// Here's our proceedure boundary that has the lifetime of 'a
'a: {
    // This allocation is only valid for the lifetime of the region, which is 'a.
    Ref::new("foobar");
}

// Destroy the region for lifetime of 'a
SPI_finish();
```

This is really powerful. But, we need a way to tie the phantom `Region` type to an actual allocation. So we'll create a new `PgPtr` type:

```rust
pub struct PgPtr<'a, T> {
    /// Enforce the proper region that has a lifetime of 'a
    region: Region<'a>,
    /// The raw unsafe pointer that has the lifetime of 'a
    ptr: UnsafeCell<*mut T>
}

impl<'a, T> PgPtr<'a, T> {
    /// Allocate a new PgPtr
    pub fn new(value: T) {
        let size = mem::size_of::<T>();
        let mut p = unsafe { pg::palloc(size as u64) };
        
        if p.is_null() {
            // Do something here...
        }
        
        unsafe { ptr::copy_memory(p, mem::transmute(&value), size) };

        PgPtr {
            region: Region(ContravariantLifetime::<'a>),
            ptr: UnsafeCell::new(p as *mut T)
        }}
}
```
