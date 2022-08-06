import { KVStorageLayer } from "@storage/KVStorageLayer";
import { DirContentIdentity, getContentHash, getContentIdentityForData } from "../ContentIdentity";
import { LocalSyncWorker } from "../LocalSync";
import { MemorySyncMetadataStorage } from "../SyncMetadataStorage";
import { LocalSyncProvider } from "../SyncProvider";
import { MapKV } from "@storage/MapKV";
import { StoragePath } from "@storage/StoragePath";
import { DiffType } from "../RemoteSync";


type CheckEntryMap = { [path: string]: Buffer | undefined };


function prepare() {
  const local = new KVStorageLayer(new MapKV());

  const remote = new KVStorageLayer(new MapKV());
  const remoteSync = new LocalSyncProvider(remote);

  const metadata = new MemorySyncMetadataStorage();
  const localSync = new LocalSyncWorker(local, remoteSync, metadata);

  return { local, remote, localSync, metadata };
}


async function makeSync(local: KVStorageLayer, localSync: LocalSyncWorker) {
  localSync.addRoot(local.get(StoragePath.root));
  await localSync.sync();
}


it("creates remote tree on local when local tree is empty", async () => {
  const d = prepare();
  await d.remote.writeOrCreate(new StoragePath("/dir/file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/dir": undefined,
    "/dir/file.txt": Buffer.from("Hello, world!"),
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("creates local sync metadata when it is lost", async () => {
  const d = prepare();
  await d.remote.writeOrCreate(new StoragePath("/dir/file.txt"), Buffer.from("Hello, world!"));
  await d.local.writeOrCreate(new StoragePath("/dir/file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/dir": undefined,
    "/dir/file.txt": Buffer.from("Hello, world!"),
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
  expect(await d.metadata.get()).toStrictEqual({
    "/dir": DirContentIdentity,
    "/dir/file.txt": getContentIdentityForData(Buffer.from("Hello, world!"))
  });
});


it("local file created", async () => {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/file.txt": Buffer.from("Hello, world!")
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("local file updated", async () => {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world! Updated"));
  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/file.txt": Buffer.from("Hello, world! Updated")
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("remote file updated", async () => {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.remote.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world! Updated"));
  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/file.txt": Buffer.from("Hello, world! Updated")
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("local and remote files updated", async () => {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.remote.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world! Updated remote"));
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world! Updated local"));
  await makeSync(d.local, d.localSync);

  expect(await d.local.entries()).toStrictEqual({
    "/file.txt": Buffer.from("Hello, world! Updated local")
  });
  expect(await d.remote.entries()).toStrictEqual({
    "/file.txt": Buffer.from("Hello, world! Updated remote")
  });

  expect(d.localSync.pendingConflicts).toMatchObject([ {
    syncResult: {
      conflict: DiffType.ConflictingUpdate,
      data: Buffer.from("Hello, world! Updated remote"),
      path: new StoragePath("/file.txt")
    }
  } ]);
});


it("local file removed", async function() {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.local.remove(new StoragePath("file.txt"));
  await makeSync(d.local, d.localSync);

  expect(await d.local.entries()).toStrictEqual({});
  expect(await d.remote.entries()).toStrictEqual({});
});


it("local file removed and remote file updated", async function() {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.local.remove(new StoragePath("file.txt"));
  await d.remote.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world! Updated"));
  await makeSync(d.local, d.localSync);

  expect(await d.local.entries()).toStrictEqual({});
  expect(await d.remote.entries()).toStrictEqual({
    "/file.txt": Buffer.from("Hello, world! Updated")
  });

  expect(d.localSync.pendingConflicts).toMatchObject([ {
    syncResult: {
      conflict: DiffType.ConflictingLocalRemove,
      data: Buffer.from("Hello, world! Updated"),
      path: new StoragePath("/file.txt")
    }
  } ]);
});


it("local file removed and remote file removed too", async function() {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.local.remove(new StoragePath("file.txt"));
  await d.remote.remove(new StoragePath("file.txt"));
  await makeSync(d.local, d.localSync);

  expect(await d.local.entries()).toStrictEqual({});
  expect(await d.remote.entries()).toStrictEqual({});
});


it("local file turned into directory", async function() {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.local.remove(new StoragePath("file.txt"));
  await d.local.createDir(new StoragePath("file.txt"));
  await makeSync(d.local, d.localSync);

  const r: CheckEntryMap = {
    "/file.txt": undefined
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("remote file turned into directory", async function() {
  const d = prepare();
  await d.local.writeOrCreate(new StoragePath("file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  await d.remote.remove(new StoragePath("file.txt"));
  await d.remote.createDir(new StoragePath("file.txt"));
  await makeSync(d.local, d.localSync);

  const r: CheckEntryMap = {
    "/file.txt": undefined
  };

  expect(d.localSync.pendingConflicts).toHaveLength(0);
  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("local tree not changed", async () => {
  const d = prepare();
  await d.remote.writeOrCreate(new StoragePath("dir/file.txt"), Buffer.from("Hello, world!"));
  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/dir": undefined,
    "/dir/file.txt": Buffer.from("Hello, world!")
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);

  await makeSync(d.local, d.localSync);

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);

  await makeSync(d.local, d.localSync);

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});


it("handles sync when a directory turned into a file", async function() {
  const d = prepare();

  await d.local.writeOrCreate(new StoragePath("dir/file.txt"), Buffer.from("Hello, local!"));

  await makeSync(d.local, d.localSync);

  let r: CheckEntryMap = {
    "/dir": undefined,
    "/dir/file.txt": Buffer.from("Hello, local!")
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);

  await d.local.remove(new StoragePath("dir"));
  await d.local.writeOrCreate(new StoragePath("dir"), Buffer.from("Hello, local!"));
  await d.remote.writeOrCreate(new StoragePath("dir/file.txt"), Buffer.from("Updated"));

  await makeSync(d.local, d.localSync);

  r = {
    "/dir": Buffer.from("Hello, local!")
  };

  expect(await d.local.entries()).toStrictEqual(r);
  expect(await d.remote.entries()).toStrictEqual(r);
});
