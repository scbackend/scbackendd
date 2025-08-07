# Scbackend

A software that uses Scratch as a backend development language.

[中文](../README.md)

## Prerequisites
Please ensure that Node.js and Git are correctly installed on your device.

## Usage Instructions
1. Execute the following command in your target directory to clone the project repository:
   ```
   git clone https://github.com/scbackend/scbackendd.git
   ```
2. Enter the `scbackendd` directory and run:
   ```
   npm link
   ```
3. Switch to your working directory and execute:
   ```
   scbackendd
   ```
   On first run, a configuration file will be generated in the current directory. You may modify it as needed.

When the console displays the following information, the service has started successfully:
```
[INFO] Server running at http://localhost:3030/
[INFO] Database connection established
```

If you only need to deploy the service, you can install it globally with the following command:
```
npm install scbackendd --global
```
Then run the following in your working directory:
```
scbackendd
```
to start the service.