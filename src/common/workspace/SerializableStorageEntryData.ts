import { StorageEntryStats } from "@storage/StorageLayer";


export interface SerializableStorageEntryData {
  path: string;
  stats: StorageEntryStats;
  children?: SerializableStorageEntryData[];
  content?: Buffer;
}



export function *walkSerializableStorageEntries(d: SerializableStorageEntryData): Generator<SerializableStorageEntryData> {
  yield d;

  if (d.children) {
    for (const child of d.children) {
      yield *walkSerializableStorageEntries(child);
    }
  }
}
