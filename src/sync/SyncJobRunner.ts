import * as mobx from "mobx";
import * as luxon from "luxon";
import { StoragePath } from "@storage/storage-path";
import { SyncJob } from "@sync/Sync";
import { timeout } from "@common/utils/timeout";


const MAX_PARALLEL_JOBS = 3;


export interface SyncJobRunnerError {
  path: StoragePath;
  error: Error;
  date: Date;
}


export interface SyncJobSource {
  getJobs(count: number, filter?: (path: StoragePath) => boolean): Promise<SyncJob[]>;

  doJob(job: SyncJob): Promise<void>;
}


const ERROR_RETRY_DELAY = luxon.Duration.fromObject({ second: 15 });
const SYNC_JOB_IDLE_TIMEOUT = luxon.Duration.fromObject({ second: 5 });


export class SyncJobRunner {
  constructor(source: SyncJobSource) {
    this.syncSource = source;
    mobx.makeObservable(this, {
      runningJobs: mobx.observable,
      errors: mobx.observable,
      isWorking: mobx.observable
    });
  }


  private async getNextJobs() {
    try {
      const jobCount = Math.max(MAX_PARALLEL_JOBS - this.runningJobs.length, 0);
      return await this.syncSource.getJobs(jobCount, jobPath => {
        if (this.lockedPaths.has(jobPath.normalized)) {
          return false;
        }

        const lastErrorTime = this.lastErrorsForPaths.get(jobPath.normalized);

        // if last error was some time ago, don't run this job
        if (lastErrorTime && luxon.DateTime.fromJSDate(lastErrorTime).plus(ERROR_RETRY_DELAY).toMillis() > Date.now()) {
          return false;
        }

        return true;
      });
    } catch (error: any) {
      console.error("Failed to get next sync jobs", error);
      return [];
    }
  }


  async run(breakOnEmpty = false): Promise<void> {
    const promiseMap = new Map<string, Promise<SyncJob>>();

    while (true) {
      this.isWorking = true;

      const nextJobs = await this.getNextJobs();
      for (let q = 0; q < nextJobs.length; ++q) {
        promiseMap.set(nextJobs[q]!.path.normalized, (async () => {
          await this.runJob(nextJobs[q]!)
          return nextJobs[q]!;
        })());
      }

      if (promiseMap.size === 0) {
        if (breakOnEmpty) {
          break;
        }

        this.isWorking = false;
        await timeout(SYNC_JOB_IDLE_TIMEOUT.as("millisecond"));
        continue;
      }

      const completedJob = await Promise.race(promiseMap.values());
      promiseMap.delete(completedJob.path.normalized);
    }

    this.isWorking = false;
  }


  private async runJob(job: SyncJob) {
    try {
      this.runningJobs.push(job);
      this.lockedPaths.add(job.path.normalized);
      await this.syncSource.doJob(job);
      this.lastSuccessfulJobDone = new Date();
      this.errors = this.errors.filter(e => !e.path.isEqual(job.path));
      this.lastErrorsForPaths.delete(job.path.normalized);
    } catch (error) {
      this.errors = this.errors.filter(e => !e.path.isEqual(job.path));
      this.errors.push({
        path: job.path,
        error: error as Error,
        date: new Date()
      });
      this.lastErrorsForPaths.set(job.path.normalized, new Date());
    }

    this.runningJobs = this.runningJobs.filter(j => !j.path.isEqual(job.path));
    this.lockedPaths.delete(job.path.normalized);
  }


  runningJobs: SyncJob[] = [];
  errors: SyncJobRunnerError[] = [];
  lastSuccessfulJobDone: Date | undefined = undefined;

  private readonly lockedPaths = new Set<string>();
  private readonly lastErrorsForPaths = new Map<string, Date>();
  private readonly syncSource: SyncJobSource;
  isWorking = false;
}
