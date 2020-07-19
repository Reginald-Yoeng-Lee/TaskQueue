declare const endPromiseResolvers: unique symbol;
declare class TaskQueue {
    private readonly tasks;
    private paused;
    private pausedCount;
    private running;
    private resolvePausedState?;
    private resolveAccumulatedPausedState?;
    private debug;
    constructor();
    /**
     * Add task related to a target with priority. The target will hold an end promise of the task. And it can be called
     * endTaskWithTarget(target) to notify the task is done later. Next task won't start until endTaskWithTarget() is
     * called.
     *
     * @param target <object> An object for holding the end promise of the task.
     * @param task <function> The job needs to run in order.
     * @param priority <number> The task will be added into the queue before every tasks with smaller priorities.
     */
    addTaskWithTarget(target: {
        [endPromiseResolvers]?: EndPromiseResolver[];
        [index: string]: any;
    }, task: Task, priority?: number): void;
    /**
     * End a running task with a target holding the end promise of the task and start next task(if any).
     *
     * @param target <object> An object holding the end promise of the task needs to end. That is, the target added with
     *                        the task.
     */
    endTaskWithTarget(target: {
        [endPromiseResolvers]?: EndPromiseResolver[];
        [index: string]: any;
    }): void;
    addTask(task: Task, endPromise?: Promise<any>): void;
    addTask(task: Task, priority?: number): void;
    /**
     * Add task running one by one. Only if the endPromise passed resolved, or the task is done (if it returns promise
     * then until the promise resolved, else until the task returned), the task is considered finished and next task starts.
     *
     * @param task <function> Action needs to execute in order. If the endPromise isn't a Promise, then the task won't
     *                        finish until the promise returned from the task function is resolved if it returns a promise or the task function returned.
     * @param endPromise <Promise | null> If it's not null, the task will be finished while the promise resolved.
     * @param priority <number> The task will be added into the queue before every tasks with smaller priorities.
     */
    addTask(task: Task, endPromise?: Promise<any>, priority?: number): void;
    private run;
    private static insert;
    /**
     * Pause for executing the remain tasks in the queue. The executing task currently will not be affected.
     *
     * @param accumulated boolean Indicate whether it can be paused for several time. If true, it has to be resumed as many times
     *                            as it has been paused for continuing executing the tasks. Otherwise, no matter how many times
     *                            it has been paused, only one resuming has to be performed. Default is true. NOTICE that
     *                            if you call pause(true) and pause(false) both, you have to also call resume(true) and resume(false)
     *                            both. They work separately.
     */
    pause(accumulated?: boolean): void;
    /**
     * Resume executing tasks in the queue after pausing.
     *
     * @param accumulated boolean Indicate which pausing way should be resumed. See pause(accumulated: boolean).
     */
    resume(accumulated?: boolean): void;
    setDebug(isDebug: boolean): void;
}
export = TaskQueue;
declare type Task = () => Promise<any> | any;
interface QueueElement {
    priority: number;
    running: boolean;
}
interface EndPromiseResolver extends QueueElement {
    resolve: (value: void | PromiseLike<void>) => void;
}
