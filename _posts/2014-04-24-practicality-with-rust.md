---
layout: post
published: true
title: "Practicality With Rust: Setting Up A Project"
---

<div>
    The Series:
    <ul>
        <li>
            Setting Up A Project
        </li>
        <li>
            <a href="../../../../2014/05/28/practicality-with-rust-error-handling/">Error Handling</a>
        </li>
    </ul>
</div>

---

This is going to be the first of many articles on the subject. The goal is to provide resources on how to use Rust effectively.

Note: I'm going to be using Rust through the master branch, and I'll be updating this series if things change.

My Rust version:

```bash
$ rustc -v
rustc 0.11.0-pre (773eb8c 2014-05-17 13:08:43 -0600)
host: x86_64-apple-darwin
```

## Let's Get Started!

Setting a new Rust project from scratch is somewhat cumbersome, currently. This will change in the future, with tools like Cargo (The future Rust package manager). For now, we'll be sticking to regular Makefiles.

Let's create a new project directory:

```
mkdir project-name
cd project-name
```

We'll generate a few folders and empty files:

```
git init
mkdir src
touch Readme.md
touch Makefile
touch src/bin.rs
touch src/lib.rs
touch .gitignore
```

Now, depending on the project (is it a library? An executable? Both?), you might not need `src/bin.rs` or `src/lib.rs`, or you might need both. `src/lib.rs` is the convention for a library, and `src/bin.rs` is the convention for an executable.

Before we go any further, you'll want to edit the `.gitignore` file.

```
# Compiled Object files
*.slo
*.lo
*.o
*.obj

# Compiled Dynamic libraries
*.so
*.dylib
*.dll

# Compiled Static libraries
*.lai
*.la
*.a
*.lib

# Executables
*.exe
*.out
*.app
*.rlib
target
```

Most of these were automatically added by Github for C++. Some that are most important are `*.rlib`, `*.dylib` and `target`.

`target` is where we'll dump what we compile, which we'll write in our Makefile.

Let's work on the Makefile.

```makefile
RUSTC ?= rustc
RUSTC_FLAGS ?=

SRC = $(shell find src -name '*.rs')

all: libprojectname

libprojectname: $(SRC)
	mkdir -p target
	$(RUSTC) --out-dir target src/lib.rs

test: $(SRC)
	mkdir -p target
	$(RUSTC) --test --out-dir target src/lib.rs
	./target/projectname

clean:
	@rm -rf target


.PHONY: clean
```

This is all you need for a library. You can copy the `libprojectname` target for an executable. The only difference is you'll want to point to `src/bin.rs` instead of `src/lib.rs`

We can now compile our library with `make` or `make libprojectname` and compile and run all the tests through `make test`.

There are more [exotic Rust makefiles](https://github.com/bvssvni/rust-empty) [out there](https://github.com/KokaKiwi/rust-mk), but I wouldn't use most of the features they offer, and writing one is pretty straightforward.


## Library

Let's start writing our library. We'll open up `src/lib.rs` to get going.

```rust
// src/lib.rs
#![crate_id = "projectname"]
#![crate_type = "lib"]
```

We just wrote two annotations to add some metadata to the library.

Now, it's your turn. The next task is to actually write the library you're dreaming of.

## Testing

Testing is pretty important. However, because Rust makes a lot more guarantees than other languages, you don't have to test simple stuff (like arguments, types, "constructors", etc...).

The main focus should be on computation and operations. Does this function have a side-effect? Does it do more than one thing? Have more than one result? Those should be signs that they need to be tested. Of course, if you have any unsafe code, it definitely **should** be tested and vetted.

Testing in Rust is built-in, so let's take advantage of that. We can place our tests along side the code we're testing. Typically, you'll want all the tests at the bottom of each file and wrapped within it's own module:

```rust
// src/lib.rs
// ... Whatever you wrote in the library would be here.

#[cfg(test)]
mod test {

    #[test]
    fn should_pass() {
        assert_eq!(1, 3);
    }
}
```

If you want to include data structures, functions that you wrote, you'll need to use the `use x;` statement.

```rust
// src/lib.rs
// ... Whatever you wrote in the library would be here.

pub struct Foo {
    i: int
}

#[cfg(test)]
mod test {
    use super::Foo;

    #[test]
    fn should_pass() {
        assert_eq!(1, 3);
    }
}
```

`Foo` will now be available to your tests.

## Wrapping Up

I think I'll stop there. While Rust is still lacking rigorous documentation and tooling, you can still get the job done. I'll also mention that dealing with dependencies is a massive pain, and you'll be resorting to something like [cargo-lite](https://github.com/cmr/cargo-lite) or following what people do in the C and C++ world (git submodules and such).


Want something covered next? Let me know either through my links at the top or the comment section!