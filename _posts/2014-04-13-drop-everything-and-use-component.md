---
layout: post
published: true
title: Drop The Chaos and Use Component(1)
---

Let's face it, CommonJS has won &mdash; AMD has lost. Let's move on to embracing this fact.

ES6 modules have adopted the CommonJS-style. Thus, both Node.js and the browser will be running the same model. However, (native) ES6 modules are far away, and it still lacks (which is a good thing) distribution.

That's where [component(1)](https://github.com/component/component) steps in. For those unaware, component(1) is a client-side package manager *and* build tool. It let's you embrace a modularized approach to building apps. component(1) supports JavaScript, CSS, templates and various other kinds of assets. These are all bundled up in a consistent manner. The JavaScript-side uses a CommonJS environment, allowing you to code *exactly* like in Node.

**Note:** I'll be addressing component, the project, as component(1), and component, in the abstract concept as is.

```js
// component(1) JavaScript
var dom = require('dom');
var debug = require('debug');
```

The important part, and what separates from tools like Browserify is the specific focus on the client-side. See, while Node has many modules available, they simply aren't built with the browser in-mind. Browserify feels (and is) a hack.

## The Bower Problem

Bower achieved being the more popular package manager for client-side assets. Cool. But, it poses a substancial problem. It leaves *you* in-charge with managing all the assets it fetched for you. This process is completely ad-hoc. Better get grunt, gulp, or Makefiles to do some work.

Moreover, it not only effects that act of building everything, but the runtime and format of these modules are chaotic. Some bundle minified assets, others don't. Some bundle concatenated files, some don't. Some bundle AMD-compatible JavaScript files, Some don't. Most, however, fill their modules with globals.

This results in an extremely poor experience for the user and community.

component(1) solves this problem because it's a package manager **and** build tool. Thus, 
it's a lot more opinionated about things than say, Bower.

## Community

The community has embraced these broken tools hole heartly. Most of the angular world, for example, lives with tools like Grunt and Bower.

Wanted an Angular bootstrap module that just *worked*? Or how about a tooltip module that provided *just tooltips* dammit. Sorry, but these tools are making these worse. Sure, Bower solves the package manager issue, but that's only part of the pie.

Have you ever wanted to get a dropdown module that works, in a matter of seconds? Again, *only dropdowns*, that's it. Or modals, or animations, or views, or...

There might be some of these modules on Bower, except they are not consistent, not composable, and will most likely use globals. Globals are not the answer.

## Dive into component(1)

You can install component(1) with NPM:

```bash
npm install component -g
```

You'll then have access to the `component` executable.

component(1) follows a similar metadata format as npm's `package.json`. Here's a `component.json` file:

```json
{
  "name": "something",
  "version": "0.0.1",
  "repo": "user/something",
  "dependencies": {
    "component/button": "*"
  },
  "development": {
    "visionmedia/mocha": "*"
  },
  "scripts": [
    "index.js"
  ],
  "templates": [
    "template.html"
  ],
  "styles": [
    "style.css"
  ]
}
```

You'll notice that you're specifying each file manually, and *that's ok*! It might be annoying to some (globs are in the works for you), but, if you use component(1) in the manner it was designed, this shouldn't be a problem.

## Unix Philosophy

The goal is to try and build small modules that do **one thing** &mdash; and do it extremely well.

That's what component(1) is following. Don't build giant components. That's why specifying each file isn't a big deal, because *you shouldn't have that many per component*. If you have more than 5, than you're probably doing more than one thing.

## Local Components

Because you want a modular environment, you'll want lots of components. However, you don't want to be creating a separate repo on Github for each (especially for a proprietary project). You'll want to use local components.

```json
{
  "name": "moduleA",
  "version": "0.0.1",
  "dependencies": {
    "component/dom": "*"
  },
  "paths": [ "." ],
  "local": [
    "moduleB",
    "moduleC",
    "moduleD",
    "moduleE",
    "moduleF"
  ]
}
```

You can specify arbitrary paths and component(1) will find the local components.

## Installing & Building

It's super simple. component(1) comes with a suite of tools, including a default builder. Yes, default. The builder executable just uses the component-builder module. It supports middleware and extra options.

Let's setup a new demo module called `demo` in a new folder. We'll include a simple `component.json` file.

```json
{
  "name": "demo",
  "version": "0.0.1",
  "repo": "user/demo",
  "dependencies": {},
  "scripts": [
    "index.js"
  ]
}
```

The `index.js` file is just empty at this point.

Let's install `component/dom` a modular jQuery-esq DOM manipulation library built for component(1). This isn't meant to have feature parity with jQuery, and it's build up by many smaller pieces.

```bash
component install component/dom --save
```

Now, you let's use that component within our `index.js` file:

```js
// demo/index.js
var dom = require('dom');

dom('body')
  .addClass('foo')
  .removeClass('fah')
  .on('click', function() {
    console.log('foo');
  });
```

While the component is called `component/dom`, component(1) aliases each component to it's `name` property within their `component.json`. This allows one to forget the notion of usernames attached to component names (as they might be hard to remember).

We can build our app with a single command:

```bash
component build --standalone demo
```

We'll have generated a new `build/` folder with a `build.js` file inside.

```html
<html>
  <head></head>
  <body>
    <script src="build/build.js"></script>
  </body>
</html>
```

When the component you're building is going to be loading via HTML, you'll want to build it with the `--standalone {name}` option. This will add code to automatically require the component when it loads.


## Consistency

Why mess with grunt, gulp, etc... to manage building your dependencies? component(1) offers the simplest and most effective route to organizing assets for the client-side.

Above all, the previous example used:

* 1 script load
* 0 globals!
* 2 commands
* 0 effort

Globals are a massive code-smell. It shows you're not using appropriate tooling to solve the problem. component(1) solves this problem.