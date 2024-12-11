# Strello Lab

Gaining understanding by dissecting the relevant parts of the SolidStart [Strello](https://github.com/solidjs-community/strello/tree/9c9ae973d96cc045914e696757a1b5f31efc6fa1) demo and then putting it together again; though perhaps from a slightly different perspective.

```bash
~$ cd strello-lab
~/strello-lab$ pnpm install
Lockfile is up to date, resolution step is skipped
Packages: +552
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 552, reused 552, downloaded 0, added 552, done

dependencies:
+ @solidjs/meta 0.29.4
+ @solidjs/router 0.15.1
+ @solidjs/start 1.0.10
+ nanoid 5.0.9
+ solid-js 1.9.3
+ unstorage 1.13.1
+ vinxi 0.4.3

devDependencies:
+ @eslint/js 9.16.0
+ eslint 9.16.0
+ eslint-plugin-solid 0.14.5
+ prettier 3.4.2
+ ts-blank-space 0.4.4
+ typescript 5.7.2
+ typescript-eslint 8.18.0

Done in 1.5s
~/strello-lab$ pnpm run init-repo

> example-basic@ init-repo /strello-lab
> node --import ts-blank-space/register ./init-repo.ts

~/strello-lab$ pnpm run dev

> example-basic@ dev /strello-lab
> vinxi dev

vinxi v0.4.3
vinxi starting dev server

 WARN  No valid compatibility date is specified.
 Using 2024-04-03 as fallback.
  Please specify compatibility date to avoid unwanted behavior changes:
     - Add compatibilityDate: '2024-12-11' to the config file.
     - Or set COMPATIBILITY_DATE=2024-12-11 environment variable.


  ➜ Local:    http://localhost:3000/
  ➜ Network:  use --host to expose
```

[Original broader reveal](https://x.com/i/status/1834639052085379213) (2024-09-13):
> Solid Community members shared this cool Trello clone demo which shows off some unique features: 
> 
> 🚀 Single Flight Mutations
>
> 🤯 Rerender-less Server Updates
>
> 🔥 Diff-less Merged Optimistic UI 
>
> Demo: https://strello.netlify.app 
>
> Github: https://github.com/solidjs-community/strello
 
---

## Notes

This *local* [`type` alias](https://github.com/solidjs-community/strello/blob/4cd269a517f09cc317da27324cf2bde25d391b4e/src/components/Board.tsx#L42-L93)

```ts
type Mutation =
  | {
      type: 'createNote';
      id: NoteId;
      column: ColumnId;
      board: BoardId;
      body: string;
      order: number;
      timestamp: number;
    }
  | {
      type: 'editNote';
      id: NoteId;
      content: string;
      timestamp: number;
    }
  | {
      type: 'moveNote';
      id: NoteId;
      column: ColumnId;
      order: number;
      timestamp: number;
    }
  | {
      type: 'deleteNote';
      id: NoteId;
      timestamp: number;
    }
  | {
      type: 'createColumn';
      id: ColumnId;
      board: string;
      title: string;
      timestamp: number;
    }
  | {
      type: 'renameColumn';
      id: ColumnId;
      title: string;
      timestamp: number;
    }
  | {
      type: 'moveColumn';
      id: ColumnId;
      order: number;
      timestamp: number;
    }
  | {
      type: 'deleteColumn';
      id: ColumnId;
      timestamp: number;
    };
```

was the pebble that started an avalanche of wheels turning. 

To be continued…
