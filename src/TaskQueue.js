const endPromiseResolvers = Symbol('hidePromiseResolver');
const targetSymbol = Symbol('target');

module.exports = class TaskQueue {

    constructor() {
        this.tasks = [];
        this._pausedCount = 0;

        this.setDebug(false);
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
    addTaskWithTarget(target, task, priority = 0) {
        if (!target || typeof target !== 'object' && typeof target !== 'function') {
            throw new Error(``)
        }
        const endPromise = new Promise(resolve => {
            if (!target[endPromiseResolvers]) {
                target[endPromiseResolvers] = [];
            }
            this._insert(target[endPromiseResolvers], {resolve}, priority);
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
    endTaskWithTarget(target) {
        if (Array.isArray(target[endPromiseResolvers])) {
            const resolver = target[endPromiseResolvers].shift();
            resolver && typeof resolver.resolve === 'function' && resolver.resolve();
        }
    }

    /**
     * Add task running one by one. Only if the endPromise passed resolved, or the task is done (if it returns promise
     * then until the promise resolved, else until the task returned), the task is considered finished and next task starts.
     *
     * @param task <function> Action needs to execute in order. If the endPromise isn't a Promise, then the task won't
     *                        finish until the promise returned from the task function is resolved if it returns a promise or the task function returned.
     * @param endPromise <Promise | null> If it's not null, the task will be finished while the promise resolved.
     * @param priority <number> The task will be added into the queue before every tasks with smaller priorities.
     */
    addTask(task, endPromise = null, priority = 0) {
        if (typeof task !== 'function') {
            throw new Error(`invalid trigger action type ${typeof task}.`);
        }

        if (typeof endPromise === 'number') {
            priority = endPromise;
            endPromise = null;
        }

        this._insert(this.tasks, {task, endPromise}, priority);

        if (!this._running) {
            this._run();
        }
    }

    async _run() {
        if (this.tasks.length === 0) {
            this._running = false;
            return;
        }
        this._running = true;

        if (this._pausedCount > 0) {
            await new Promise(resolve => {
                this._resolvePausedState = resolve;
            });
        }

        const taskWrapper = this.tasks.shift();
        const result = taskWrapper.task();
        let promise = null;
        if (taskWrapper.endPromise instanceof Promise) {
            promise = taskWrapper.endPromise;
            // Find the end promise corresponding to this task and mark as running. Prevent another end promise of higher priority task adding before current end promise.
            if (promise[targetSymbol] && Array.isArray(promise[targetSymbol][endPromiseResolvers]) && promise[targetSymbol][endPromiseResolvers] > 0) {
                const wrapper = promise[targetSymbol][endPromiseResolvers][0];
                wrapper._running = true;
            }
        } else if (result instanceof Promise) {
            promise = result;
        }
        try {
            promise && await promise;
        } catch (e) {
            this._debug && console.error(e);
        }

        this._run();
    }

    _insert(queue, originItem, priority) {
        for (let [i, wrapper] of queue.entries()) {
            if (!wrapper._running && wrapper.priority < priority) { // Only add after running wrapper.
                queue.splice(i, 0, {...originItem, priority});
                return;
            }
        }
        queue.push({...originItem, priority});
    }

    pause() {
        this._pausedCount++;
    }

    resume() {
        this._pausedCount > 0 && this._pausedCount--;
        if (this._pausedCount <= 0 && this._resolvePausedState) {
            this._resolvePausedState();
            delete this._resolvePausedState;
        }
    }

    setDebug(isDebug) {
        this._debug = isDebug;
    }
}