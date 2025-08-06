# Scbackend

A software that enables Scratch to become a backend language.

[中文](../README.md)

## Prerequisites
Please make sure your device has Node.js and git installed correctly.

## How to Use
Navigate to the directory where you want to place the service, then enter `git clone https://github.com/scbackend/scbackendd.git`

Switch to the scbackendd directory and enter `npm link`

Switch to your working directory and enter `scbackendd`. The first time you run it, a configuration file will be generated in the directory, which you can modify as needed.

If you see the following two lines in the console, the service is running normally:

```
[INFO] Server running at http://localhost:3030/
[INFO] Database connection established
```

If you just want to deploy without modification, you can install it with one command:

```
npm install scbackendd --global
```

Then switch to your working directory and enter `scbackendd` to start.