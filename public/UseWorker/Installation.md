# Feliz.UseWorker - Installation

To install `Feliz.UseWorker` into your project, 
you need to install the nuget package into 
your F# project:

```bash
# nuget
dotnet add package Feliz.UseWorker
# paket
paket add Feliz.UseWorker --project ./project/path
```
Then you need to install the corresponding npm dependencies.
```bash
npm install --save-dev @babel/core
npm install --save-dev @babel/preset-env
npm install --save-dev babel-loader
npm install --save-dev core-js
npm install --save-dev fable-compiler
npm install --save-dev fable-loader
npm install --save-dev fast-glob
npm install --save-dev webpack

___

yarn add @babel/core --dev
yarn add @babel/preset-env --dev
yarn add babel-loader --dev
yarn add core-js --dev
yarn add fable-compiler --dev
yarn add fable-loader --dev
yarn add fast-glob --dev
yarn add webpack --dev

```

### Use Femto

If you happen to use [Femto], then it can 
install everything for you in one go:

```bash
cd ./project
femto install Feliz.UseWorker
```
Here, the nuget package will be installed 
using the package manager that the project 
is using (detected by Femto) and then the 
required npm packages will be resolved

[Femto]: https://github.com/Zaid-Ajaj/Femto
