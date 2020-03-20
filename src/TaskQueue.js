const endPromiseResolvers = Symbol('hidePromiseResolver');

export default class TaskQueue {

    constructor() {
        this.tasks = [];
        this._pausedCount = 0;

        this.setDebug(false);
    }

    /**
     * 添加要显示的弹窗及显示动作
     *
     * @param target <object> 要显示的弹窗
     * @param triggerAction <function> 显示弹窗的动作方法
     */
    addTaskWithTarget(target, triggerAction, priority = 0) {
        if (!target || typeof target !== 'object' && typeof target !== 'function') {
            throw new Error(``)
        }
        const hidePromise = new Promise(resolve => {
            if (!target[endPromiseResolvers]) {
                target[endPromiseResolvers] = [];
            }
            target[endPromiseResolvers].push(resolve);
            this._insert(target[endPromiseResolvers], {resolve}, priority);
        });
        this.addTask(triggerAction, hidePromise);
    }

    /**
     * 通知弹窗已关闭, 如果有下一需要显示的弹窗将会自动显示
     *
     * @param popup object 已关闭的弹窗
     */
    notifyPopupHide(popup: Object) {
        if (Array.isArray(popup[endPromiseResolvers])) {
            const resolver = popup[endPromiseResolvers].shift();
            typeof resolver === 'function' && resolver();
        }
    }

    /**
     * 添加要显示的弹窗动作
     *
     * @param triggerAction function 显示弹窗的动作方法
     * @param endPromise Promise | null 弹窗已隐藏的结果, 如果为空, 则检查triggerAction() 的返回结果, 如果结果为Promise 对象, 则使用返回结果替代hidePromise, 否则视为弹窗显示后立即关闭(通常为错误用法)
     */
    addTask(triggerAction, endPromise = null, priority = 0) {
        if (typeof triggerAction !== 'function') {
            throw new Error(`invalid trigger action type ${typeof triggerAction}.`);
        }

        this.tasks.push({triggerAction, endPromise});

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
        const result = taskWrapper.triggerAction();
        let promise = null;
        if (taskWrapper.endPromise instanceof Promise) {
            promise = taskWrapper.endPromise;
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

    _insert(queue, targetWrapper, priority) {
        for (let [i, wrapper] of queue) {
            if (wrapper.priority < priority) {
                queue.splice(i, 0, {...targetWrapper, priority});
                return;
            }
        }
        queue.push({...targetWrapper, priority});
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