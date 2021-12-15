# ABI Pack Framework

This is the system that generates ABI content for the [GridPlus](https://gridplus.io) [Lattice1](https://gridplus.io/lattice) to use for adding contract metadata.

New contract metadata can be added to this repository by anyone via Pull Request (PR).

## How to Add ABI Packs

To add contract data, open a PR targeting the `main` branch of this repository with your new contract files added.

Contract data must be in a file with a `.json` (or `.jsonc` if the file contains comments) extension in the `/contracts` directory. The data must conform to the following format:

```ts
{
  name: string;
  desc: string;
  version: string;
  website: string;
  addresses: [
    {
      address: string;
      tag: string;
    }
  ];
}
```

If your PR is approved and merged, the new data will be transformed into an ABI-compatible format that will be made available for all Lattice1 devices to consume.
