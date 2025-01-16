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
+ @solidjs/router 0.15.3
+ @solidjs/start 1.0.11
+ nanoid 5.0.9
+ solid-js 1.9.4
+ unstorage 1.14.4
+ vinxi 0.4.3

devDependencies:
+ @eslint/js 9.16.0
+ eslint 9.16.0
+ eslint-plugin-solid 0.14.5
+ prettier 3.4.2
+ ts-blank-space 0.4.4
+ typescript 5.7.2
+ typescript-eslint 8.18.0

Done in 1.7s

~/strello-lab$ mv example.env .env

~/strello-lab$ pnpm run init-repo

> strello-lab@0.0.0 init-repo ~/strello-lab
> node --env-file=.env --import ts-blank-space/register ./init-repo.ts

~/strello-lab$ pnpm run dev

> strello-lab@0.0.0 dev ~/strello-lab
> vinxi dev

vinxi v0.4.3
vinxi starting dev server

 WARN  No valid compatibility date is specified.

ℹ Using 2024-04-03 as fallback.
  Please specify compatibility date to avoid unwanted behavior changes:
     - Add compatibilityDate: '2025-01-16' to the config file.
     - Or set COMPATIBILITY_DATE=2025-01-16 environment variable.


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

The functionality/content for the page under the [board route](https://github.com/solidjs-community/strello/blob/9c9ae973d96cc045914e696757a1b5f31efc6fa1/src/routes/board/%5Bid%5D.tsx) falls largely on the [`Board` component](https://github.com/solidjs-community/strello/blob/9c9ae973d96cc045914e696757a1b5f31efc6fa1/src/components/Board.tsx) while in fact the various mutations of the board's parts are collocated among it's parts:
- [Column](https://github.com/solidjs-community/strello/blob/9c9ae973d96cc045914e696757a1b5f31efc6fa1/src/components/Column.tsx) collocates the `AddColumn`, `Column`, and `ColumnGap` components with the `createColumn`, `renameColumn`, `moveColumn`, `deleteColumn` [actions](https://docs.solidjs.com/solid-router/reference/data-apis/action#action).
- [Note](https://github.com/solidjs-community/strello/blob/9c9ae973d96cc045914e696757a1b5f31efc6fa1/src/components/Note.tsx) collocates the `AddNote` and `Note` components with the `createNote`, `editNote`, `moveNote`, `deleteNote` actions.

Superficially this collocation may seem *obvious* and convenient but it's reminiscent of the convenience associated with [`ActiveRecord`](https://en.wikipedia.org/wiki/Active_record_pattern#Criticism) (e.g. [The troublesome “Active Record” Pattern](https://calpaterson.com/activerecord.html)). 

Meanwhile inside the `Board` component eight separate [`useSubmission`](https://docs.solidjs.com/solid-router/reference/data-apis/action#usesubmissionusesubmissions) hooks are necessary (forcing the other modules to export the associated actions) to track the submissions made by the `AddColumn` (`createColumn`), `ColumnGap` (`moveColumn`) , `Column` (`renameColumn`, `deleteColumn`), `AddNote` (`createNote`) and `Note` component (`editNote`, `moveNote`, `deleteNote`) for the purpose of [optimistic UI](https://www.smashingmagazine.com/2016/11/true-lies-of-optimistic-user-interfaces/). Finally to implement the optimistic UI, the command-like `Mutation`'s are derived in order to (visibly) advance client side state before the updated board data from the server becomes available.

It should be noted that in terms of CRUD operations the board route is responsible for the initial “READ board” while the eight actions are roughly responsible for the “CREATE, UPDATE, DELETE column” and “CREATE, UPDATE, DELETE note” operations. However each successful action will also implicitly supply the data equivalent of a recent “READ board” operation. 

The latest server board data is maintained within the [`Board` component's `props`](https://github.com/solidjs-community/strello/blob/9c9ae973d96cc045914e696757a1b5f31efc6fa1/src/components/Board.tsx#L95). It's however the content of the [`boardStore`](https://github.com/solidjs-community/strello/blob/9c9ae973d96cc045914e696757a1b5f31efc6fa1/src/components/Board.tsx#L96-L100) [Store](https://docs.solidjs.com/reference/store-utilities/create-store) that drives the board UI: 
- whenever `props.board` are refreshed from the server, the data is augmented with currently pending `Mutations` before `boardStore` is [reconciled](https://docs.solidjs.com/reference/store-utilities/reconcile) to it's updated, optimistic state.
- whenever new board `Mutation`s are submitted they are [produced](https://docs.solidjs.com/reference/store-utilities/produce) into the existing `boardStore` so that they are immediately, optimistically reflected in the UI.

### `Board` is the “aggregate”; `Column` and `Note` its parts 

The `Mutation`s and the optimistic processing emphasize that `Board` is an [“aggregate”](https://martinfowler.com/bliki/DDD_Aggregate.html) of which `Column`s and `Note`s are “mere” parts. Put differently, given the central nature of `Board`'s `boardStore`, the role of the `Board` component is that of a [container component](https://www.patterns.dev/react/presentational-container-pattern/#container-components). Meanwhile the nested components like `Column` and `Note` lean more heavily towards the role of a [presentation component](https://www.patterns.dev/react/presentational-container-pattern/#presentational-component). If so, [design cohesion](https://vanderburg.org/blog/2011/01/31/cohesion.html) would suggest to place the actions together with the `Board` component while making them available to the parts via callback `props`. 

### The Road not taken but suggested by the `Mutation` discriminated union

`stello-lab` explores an alternate client architecture as hinted at the `Mutation` type shown above. While `Mutation` is a type internal to the original `Board` component, in `strello-lab` it lead to `BoardCommand` ([`client-types.ts`](src/client-types.ts)):

```ts
type MoveRelation = {
  refId: string;
  before: boolean;
};

type NoteMove = {
  kind: 'noteMove';
  refId: string; // ID of note to be move
  updatedAt: number; // note's updatedAt for first-one-wins optimisitc locking
  columnRefId: string; // ID of column note is moved to
  relation?: MoveRelation; // info to another note already within
  // column relative to which the moved note is ranked
  rank: LexRank; // client-only: rank to be used for optimistic UI
  submitted: number; // client-only: command submission time
  // used with reference to boardStore's "synchronized" time
};

type BoardCommand =
  | ColumnAppend
  | ColumnDelete
  | ColumnEdit
  | ColumnMove
  | NoteAppend
  | NoteEdit
  | NoteDelete
  | NoteMove;
```

Each distinct “command” serves two purposes:
- primary: information needed by the server to complete the action (mutation)
- secondary: information generated during submission to support optimistic UI

Each command is the one-and-only argument passed to the action. As any necessary optimistic UI information is already included in each command additional, post-mutation derivation work is avoided. For example in the above `NoteMove` command the server will ignore the `rank` and `submitted` properties which are only included for the client-side optimistic UI. 

Given that the various `BoardCommand`s are now part of one unified [discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions), the board actions can be unified as well: [`transformBoard`](src/server/api.ts) (the actual handling of server side persistent storage is delegated to [`src/server/repo.ts`](src/server/repo.ts)). 

With the recent renaming of [`cache`](https://docs.solidjs.com/solid-router/reference/data-apis/cache#cache) to [`query`](https://docs.solidjs.com/solid-router/reference/data-apis/query) an interesting observation can be made. In [`src/server/api.ts`](src/server/api.ts) the pair of `boardById` and `transformBoard` expresses a kind of [command query separation](https://martinfowler.com/bliki/CommandQuerySeparation.html); it is only by virtue of SolidStart's revalidation mechanism that `transformBoard` triggers `boardById` to supply the client with up-to-date board data.

Taking that thinking further `transformBoard` can be seen as almost “reducer-like”; the inbound command and (server-based) board data are reduced to the next “board state” which is immediately communicated to the client.

This further emphasizes the key responsibility that the [`Board` component](src/components/boards.tsx) has; centrally assembling and dispatching the `BoardCommand`s to:
1. affect server state and
2. drive optimistic UI

It's the advantages of command centralization that make it easier to justify passing callbacks via `props` in the shape of progressively augmented services from `Board` to `Column` (via [`ColumnServices`](src/client-types.ts)) to `Note` (via `NoteServices`). This way both `Column` and `Note` have the access they require to effect necessary change while neither is being directly coupled to any commands issued nor details of the server side persistence technology, while all the processing related to keeping `boardStore` “in sync” is in relative proximity to the `Board` component which orchestrates all the actions against the board data.

Given that `Board` contains essentially [lifted up state](https://react.dev/learn/sharing-state-between-components#lifting-state-up-by-example) for `Note` and `Column`, having them delegate mutations back to `Board` aligns with the thinking behind [“Tell, Don't Ask”](https://toolshed.com/articles/1998-07-01-TellDontAsk.html) ([The Art of Enbugging](https://media.pragprog.com/articles/jan_03_enbug.pdf)). Rather than issuing the mutation from a presentation component directly, rely on the `Board` to know how to implement any given mutation (an the optimistic UI) as it has direct access to the entire context that the column or note data exists in. 
