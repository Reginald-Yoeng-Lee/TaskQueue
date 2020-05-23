const TaskQueue = require('../lib/TaskQueue');

const taskQueue = new TaskQueue();

const target = {};

taskQueue.addTaskWithTarget(target, () => {
    console.log('Task 4 starts');

    setTimeout(() => {
        console.log('Task 4 ends');
        taskQueue.endTaskWithTarget(target);
    }, 3000);
}, 999);

taskQueue.addTaskWithTarget(target, () => {
    console.log('Task 5 starts');

    setTimeout(() => {
        console.log('Task 5 ends');
        taskQueue.endTaskWithTarget(target);

        setTimeout(testAddTask, 2000);

        taskQueue.pause();
        taskQueue.pause();
        taskQueue.pause(false);

        setTimeout(() => {
            console.log('resume 1');
            taskQueue.resume();
        }, 3000);

        setTimeout(() => {
            console.log('resume 2');
            taskQueue.resume();
        }, 4000);

        setTimeout(() => {
            console.log('resume 3');
            taskQueue.resume(false);
        }, 5000);
    }, 4000);
}, 999);

taskQueue.addTaskWithTarget(target, () => {
    console.log('Task 6 starts');

    setTimeout(() => {
        console.log('Task 6 ends');
        taskQueue.endTaskWithTarget(target);
    }, 5000);
}, 1000);

const testAddTask = () => {
    taskQueue.addTask(() => {
        console.log('Task 1 starts.');
        return new Promise(resolve => {
            setTimeout(() => {
                console.log('Task 1 ends.');
                resolve();
            }, 3000);
        });
    }, 9999);
    taskQueue.addTask(() => {
        console.log('Task 2 starts.');
        return new Promise(resolve => {
            setTimeout(() => {
                console.log('Task 2 ends.');
                resolve();
            }, 1000);
        });
    }, 9999);
    taskQueue.addTask(() => {
        console.log('Task 3 starts.');
        return new Promise(resolve => {
            setTimeout(() => {
                console.log('Task 3 ends.');
                resolve();
            }, 2000);
        });
    }, 10000);
};
