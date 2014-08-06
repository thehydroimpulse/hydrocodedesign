---
title: "Building a Gimbal in Rust: An Introduction"
layout: post
published: true
---

<img width="900" src="/public/img/gimbal.jpg" class="poster" />

I'm currently spending a few hours on the weekends building a side-project with my brother. We're attempting to build a fully functioning gimbal for two DSLRs (they're two different sizes). And yes, we're currently writing the software to operate the machine in Rust.

# What's a Gimbal?

A gimbal is a pivoted support that allows the rotation of an object around a single axis. They are used everywhere, from rocket engines, to missiles, to photography and film. It also touches on several areas of computing and engineering and requires a collection of devices to operate correctly.

It just seemed logical to try and build it. I'll, once again, inadequately use the word "simple" in "it'll be pretty simple to build". I say that for everything, so I'm probably using it wrong. I was also pretty big into film and directing a while back, but I just never had the proper equipment to actually create my visions.

I should also mention that gimbals come in all shape, sizes, and with a ton of different functionality. The image above isn't the type of gimbal we're building, ours is a 3-axis gimbal focused for film and photography not missiles, so you can essentially run, dance, do whatever and the camera will always be stabilized. We're not at the stage of building out the material for it yet, we're working in the prototyping phase right now.

# Why Rust

Rust is new (for programming languages), not 1.0 and is targeting itself as a system programming language &mdash &mdash; even though that has no concrete definition. We all know what kind of system Rust targets to be good at writing software for: writing browser engines, low-level systems, embedded devices, kernels, etc... All these have hard requirements and very little room to move in. The chip I'm using for the brains of the gimbal has a 100Mhz processor, and 32KB of RAM. And it's not the smallest chip available by far. So having a garbage collector is just not possible with those specs. Moreover, at this level of abstraction (i.e., very little), we need to be able to access the registers and what not of the chip. This is a must. To enable the ADC (Analog-to-digital converter), you need to set the 12th bit of the PCONP register to 1 (that's actually only the first step to enable it). It's that specific.

Another reason for choosing Rust was because Mbed by default as an **online compiler** for programming in it. Yes, you heard that correctly. An online compiler for doing *embedded development*. I wasn't too happy with that. Not to mention that their SDK is a piece of shit C and C++ mixture. I'd much rather it be **one** of them, not both. I went ahead and searched the interwebs for a normal C library and linker for that chip. I managed to get it working, somewhat, but again, the library was a complete mess. Horribly written, static variables coming out everyone's ears.

So fuck it. I didn't want to use shitty mbed libraries. I had been following [Zinc.rs](https://github.com/hackndev/zinc) which attempts to be a bare metal stack for Rust. I got the LEDs blinking in under 5 minutes. Zinc is still really early, but it has a lot of promise!

# Components

The first task we had was to outline exactly what we needed in terms of components. What kind of chip did we want/need? How many gyroscopes, accelerometers, and motors did we need? What kind of motor? Analog vs I2C? What was our power requirements? How many and what kind of resisters did we need?

These were all questions we needed to answer first.

### Board

We chose the [LPC1768](https://mbed.org/platforms/mbed-LPC1768/) ARM chip. This is one of the boards currently supported by Zinc. It doesn't have the best ADC, in-fact, it can be kinda wonky at times, but it works. There's also a lot of noise that interferes with the readings, so you have to work around it. However, it's a good little board. The software side of things are shitty, like the online compiler.

### Accelerometer

Because our gimbal doesn't receive heavy inputs in terms of g-force, we needed something fairly accurate. One that can detect &plusmn;200g wasn't very useful to us. So we went with the [MMA7361](https://www.sparkfun.com/products/9652) triple axis accelerometer that has a g-select (two different detection levels of &plusmn;1.5g and &plusmn;6g), low power consumption, a perfect voltage rating of 2.2V - 3.3V (which is what our board is powered at with the USB). We just got a battery holder that can support higher volts so we'll need to further protect the accelerometer by only giving it 3.3V.

The gimbal we're building has a top bar with the ends bent (in-wards) for the handles. One holds the gimbal by holding those handles. When we start running, or moving the gimbal side-by-side, we don't want the whole thing to be static, yet we want it stabilized. This is where the accelerometer comes into play. The accelerometer sits somewhere in the middle of that bar. We can now detect the movement on the 3-axis and further position the camera with motors *in a steady motion* and at a slightly delayed timing. This ensures that the camera is extremely stable.

---

Right now, we're just working with the board and accelerometer before moving onto the other components.


### Diving into Software

Let's get into the software side of things for a bit. As of this writing, We have finished writing a device driver for the MMA7361 accelerometer within Zinc that can output millivolts, volts, and g-force. This was pretty tedious because of the ADC. Powering it on looked something like:

```rust
// Flip the 12th bit on the PCONP register to enable the ADC.
reg::PCONP.set_value(reg::PCONP.value() | (1 << 12));
// Set the AD0CR to 1, set the clock divider to
// /4/2 and enable the 21st bit (PDN, 1 = operational, 0 = power-down mode).
reg::AD0CR.set_value(1 | (1 << 8) | (1 << 21));
```

That doesn't include setting up the pins to operate in the alternative function 1 space. By default, pins are operating in the [GPIO](http://en.wikipedia.org/wiki/General-purpose_input/output) (General-purpose input/output) space.

```rust
// Enable pin 15 (physical) to use the ADC alternative function meaning it'll be
// AD0.0 (Port 0 Pin 0)
// Note: PINSEL1 controls the upperhalf of Port 0, so since our physical pin is Port 0 Pin
//       15, we need the upperhalf.
reg::PINSEL1.set_value(reg::PINSEL1.value() & !(0x3 << 14) | (0x1 << 14));
```

Now that the ADC is successfully turned on for *that single pin*, we can now use it to convert an analog signal. Remember, analog signals are in terms of volts coming in. The lpc1768 outputs integers 0 to 4096 from the analog readings. 0 = 0V and 4096 = 3.3V. One can then use those numbers and convert them to a g-force reading, which is also useful and more understandable at times.

```rust
// The 24th bit (START) on the AD0CR (A/D Control Register 0x40034000) needs to be
// set to 1 to start a conversion.
reg::AD0CR.set_value(reg::AD0CR.value() | (1 << 24));
```

Now, ADC conversions take time (not a lot of time, but time nonetheless.). It's currently operating at ~12.5Mhz (the chip is running at 100Mhz for perspective) because 13Mhz is the maximum, so we use the system clock to divide it by 4, then 2, to get 12.5.

The next step is to employ a while loop to wait until the sampling is done. Per the user manual, the DONE bit on the AD0CR register is the 31st bit. So it's pretty easy to wait until it's set to 1.

```rust
// Loop until the DONE bit (31) is set to 1.
while (reg::ADDR0.value() & (1 << 31)) == 0 {}
```

Finally! We can **actually** start reading some data, some true values. We can read the result bits of that same register which is from bit 4 and 15.

```
(reg::ADDR0.value() >> 4) & 0xfff
```

We're just bit shifting by 4 and masking the value. At this level, we have to get used to these types of operations. They're everywhere!


### User Manual

If you ever want to tinker with these type of things, always consult the user manual and data sheet. **They're invaluable information** about all the details needed to make it functional. For example, Zinc only had a small number of registers defined. Those didn't include all the ADC and PCONP registers. We had to define them ourselves. So we consulted the documentation, got the memory address and voila! Zinc also made it pretty easy to define the registers in the linker and in Rust code. They're also working on improving the register situation.

### Volts, Millivolts, and G-Force

> But what if I want to read volts or g-forces and not some arbitrary range of integers?

It's proportional. For the LPC1768 (Remember, consult the manual to be sure), it's 800mV/g and you can get the millivolts by multiplying the raw analog reading with 0.80566.

### Driver

We're cleaning up the driver and the ADC implementation and I'll be sending a pull request to the Zinc project with it. So people can easily pick up the same parts and start right away! We'll be doing the same for each and every other component we work with.

### Development Environment

Since I sold my last PC a couple months ago, I've been a full-time Mac user. That's great, but when you're working with cross-compilers and such, Linux is so much easier. So I got a vagrant box setup with Zinc, Rust, and GCC all cross-compiling to ARM. And then I use the mac to interact with uploading the final `.bin` to the board (it's a simple `cp` command to `/Volumes/MBED`). I haven't tried getting everything working on the mac since my last failed attempt. I'm just gonna stick with this setup for now.

### Take away

Embedded development is really awesome! You get to work in a very different environment, with new tools, techniques and a new layer to think about (hardware). There was a lot of debugging to get the ADC to work and a lot of various trials and errors.


# Next Step

The next step is moving onto the next parts, writing drivers for them, connecting them up and then starting to piece them together. We're going to be prototyping with the body once we get the motors and stuff, and I'll be writing every step of the way.



P.S. I'll take some pictures of our breadboard when I can.

You can also discuss in the comment section or take it over to Reddit:

* [r/rust](http://www.reddit.com/r/rust/comments/2cqexr/building_a_gimbal_in_rust_an_introduction/)
* [r/programming](http://www.reddit.com/r/programming/comments/2cqnz4/building_a_gimbal_in_rust_an_introduction/)
