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
npm install rollup --save-dev
npm install fast-glob --save-dev

npm install rollup-plugin-cleanup --save-dev // Recommended, but not necessary

___

yarn add rollup --dev
yarn add fast-glob --dev

yarn add rollup-plugin-cleanup --dev // If you plan to use snapshot testing
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

Do note that this will *not* install the 
optional dependencies listed above (the 
rollup plugin).

[Femto]: https://github.com/Zaid-Ajaj/Femto
