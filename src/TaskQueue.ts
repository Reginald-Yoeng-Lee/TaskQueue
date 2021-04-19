const endPromiseResolvers = Symbol('hidePromiseResolver');
const targetSymbol = Symbol('target');

class TaskQueue {

    private readonly tasks: TaskWrapper<any>[];

    private paused: boolean;
    private pausedCount: number;

    private running: boolean = false;

    private resolvePausedState?: ((value: void) => void);
    private resolveAccumulatedPausedState?: ((value: void) => void);

    private debug: boolean = false;

    constructor() {
        this.tasks = [];
        this.paused = false;
        this.pausedCount = 0;
    }

    /**
     * Add task related to a target with priority. The target will hold an end promise of the task. And it can be called
     * endTaskWithTarget(target) to notify the task is done later. Next task won't start until endTaskWithTarget() is
     * called.
     *
     * @param target <object> An object for holding the end promise of the task.
     * @param task <function> The job needs to run in order.
     * @param priority <number> The task will be added into the queue before every tasks with smaller priorities.
     */
    addTaskWithTarget(target: { [endPromiseResolvers]?: EndPromiseResolver[], [index: string]: any }, task: Task<any>, priority = 0): void {
        if (!target || typeof target !== 'object' && typeof target !== 'function') {
            throw new Error(`Target type ${typeof target} is invalid.`);
        }
        const endPromise: WrappedPromise<any> = new Promise(resolve => {
            if (!target[endPromiseResolvers]) {
                target[endPromiseResolvers] = [];
            }
            TaskQueue.insert(target[endPromiseResolvers]!, {resolve}, priority);
        });
        // keep the target object. Mark the resolver wrapper running while task started.
        endPromise[targetSymbol] = target;
        this.addTask(task, endPromise, priority);
    }

    /**
     * End a running task with a target holding the end promise of the task and start next task(if any).
     *
     * @param target <object> An object holding the end promise of the task needs to end. That is, the target added with
     *                        the task.
     */
    endTaskWithTarget(target: { [endPromiseResolvers]?: EndPromiseResolver[], [index: string]: any }): void {
        if (Array.isArray(target[endPromiseResolvers])) {
            const resolver = target[endPromiseResolvers]!.shift();
            resolver && typeof resolver.resolve === 'function' && resolver.resolve();
        }
    }

    addTask<Result>(task: Task<Result>, endPromise?: Promise<Result>): Promise<Result>;
    addTask<Result>(task: Task<Result>, priority?: number): Promise<Result>;
    /**
     * Add task running one by one. Only if the endPromise passed resolved, or the task is done (if it returns promise
     * then until the promise resolved, else until the task returned), the task is considered finished and next task starts.
     *
     * @param task <function> Action needs to execute in order. If the endPromise isn't a Promise, then the task won't
     *                        finish until the promise returned from the task function is resolved if it returns a promise or the task function returned.
     * @param endPromise <Promise | null> If it's not null, the task will be finished while the promise resolved.
     * @param priority <number> The task will be added into the queue before every tasks with smaller priorities.
     * @return Result The result produced by the task.
     */
    addTask<Result>(task: Task<Result>, endPromise?: Promise<Result>, priority?: number): Promise<Result>;

    addTask<Result>(task: Task<Result>, endPromise?: Promise<Result> | number, priority: number = 0): Promise<Result> {
        if (typeof task !== 'function') {
            throw new Error(`invalid trigger action type ${typeof task}.`);
        }

        if (typeof endPromise === 'number') {
            priority = endPromise;
            endPromise = undefined;
        }

        let resolve, reject;
        const result = endPromise || new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        TaskQueue.insert<TaskWrapper<Result>[], QueueElement<Result>>(this.tasks, {
            task,
            endPromise,
            resolve,
            reject,
        }, priority);

        if (!this.running) {
            this.run();
        }

        return result;
    }

    private async run(): Promise<void> {
        if (this.tasks.length === 0) {
            this.running = false;
            return;
        }
        this.running = true;

        if (this.pausedCount > 0 || this.paused) {
            await Promise.all([
                new Promise(resolve => this.resolvePausedState = resolve),
                new Promise(resolve => this.resolveAccumulatedPausedState = resolve),
            ])
        }

        const taskWrapper = this.tasks.shift();
        let result: Promise<any>;
        try {
            const r = taskWrapper?.task();
            result = r instanceof Promise ? r : Promise.resolve(r);
        } catch (e) {
            result = Promise.reject(e);
        }
        let promise: WrappedPromise<any>;
        if (taskWrapper?.endPromise instanceof Promise) {
            promise = taskWrapper.endPromise;
            const target: { [endPromiseResolvers]?: EndPromiseResolver[] } | undefined = promise[targetSymbol];
            // Find the end promise corresponding to this task and mark as running. Prevent another end promise of higher priority task adding before current end promise.
            if (target && (target[endPromiseResolvers]?.length ?? 0) > 0) {
                target[endPromiseResolvers]![0].running = true;
            }
        } else {
            promise = result;
        }
        try {
            const value = await promise;
            taskWrapper?.resolve?.(value);
        } catch (e) {
            this.debug && console.error(e);
            taskWrapper?.reject?.(e);
        }

        this.run();
    }

    private static insert<Queue extends Array<Item & QueueElementProperty>, Item>(queue: Queue, originItem: Item, priority: number): void {
        for (let [i, wrapper] of queue.entries()) {
            if (!wrapper.running && wrapper.priority < priority) { // Only add after running wrapper.
                queue.splice(i, 0, {...originItem, priority, running: false});
                return;
            }
        }
        queue.push({...originItem, priority, running: false});
    }

    /**
     * Pause for executing the remain tasks in the queue. The executing task currently will not be affected.
     *
     * @param accumulated boolean Indicate whether it can be paused for several time. If true, it has to be resumed as many times
     *                            as it has been paused for continuing executing the tasks. Otherwise, no matter how many times
     *                            it has been paused, only one resuming has to be performed. Default is true. NOTICE that
     *                            if you call pause(true) and pause(false) both, you have to also call resume(true) and resume(false)
     *                            both. They work separately.
     */
    pause(accumulated: boolean = true): void {
        accumulated ? this.pausedCount++ : (this.paused = true);
    }

    /**
     * Resume executing tasks in the queue after pausing.
     *
     * @param accumulated boolean Indicate which pausing way should be resumed. See pause(accumulated: boolean).
     */
    resume(accumulated: boolean = true): void {
        if (accumulated) {
            this.pausedCount > 0 && this.pausedCount--;
        } else {
            this.paused = false;
        }
        if (this.pausedCount <= 0 && this.resolveAccumulatedPausedState) {
            this.resolveAccumulatedPausedState();
            delete this.resolveAccumulatedPausedState;
        }
        if (!this.paused && this.resolvePausedState) {
            this.resolvePausedState();
            delete this.resolvePausedState;
        }
    }

    setDebug(isDebug: boolean): void {
        this.debug = isDebug;
    }
}

export default TaskQueue;
export {TaskQueue};

type Task<Result> = () => Promise<Result> | Result;

interface QueueElementProperty {
    priority: number;
    running: boolean;
}

interface QueueElement<Result> {
    task: Task<Result>;
    endPromise?: WrappedPromise<Result>;
    resolve?: (value: Result | PromiseLike<Result>) => void;
    reject?: (reason?: any) => void;
}

interface EndPromiseResolver extends QueueElementProperty {
    resolve: (value: void | PromiseLike<void>) => void;
}

interface TaskWrapper<Result> extends QueueElementProperty, QueueElement<Result> {
}

interface WrappedPromise<Result> extends Promise<Result> {
    [targetSymbol]?: { [endPromiseResolvers]?: EndPromiseResolver[] };
}