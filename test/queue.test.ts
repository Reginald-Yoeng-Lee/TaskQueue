import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import TaskQueue from "../src/TaskQueue";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('TaskQueue testing', function () {
    describe('TaskQueue task order', function () {
        it('task order', async function () {
            const queue = new TaskQueue();
            const intermediateResults: number[] = [];
            const results: number[] = [];

            await Promise.all([
                queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([]);
                    intermediateResults.push(1);
                    return 1;
                }).then(r => results.push(r)),
                queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([1]);
                    intermediateResults.push(2);
                    return 2;
                }).then(r => results.push(r)),
                queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([1, 2]);
                    intermediateResults.push(3);
                    return 3;
                }).then(r => results.push(r)),
            ]);

            expect(results).deep.eq([1, 2, 3]);
        });

        it('priority task order', async function () {
            const queue = new TaskQueue();
            const intermediateResults: number[] = [];
            const results: number[] = [];

            await Promise.all([
                queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([]);
                    intermediateResults.push(1);
                    return 1;
                }).then(r => results.push(r)),
                queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([1, 3]);
                    intermediateResults.push(2);
                    return 2;
                }).then(r => results.push(r)),
                queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([1]);
                    intermediateResults.push(3);
                    return 3;
                }, 1).then(r => results.push(r)),
            ]);

            expect(results).deep.eq([1, 3, 2]);
        });

        it('task with failure', async function () {
            const queue = new TaskQueue();
            const intermediateResults: number[] = [];

            await Promise.all([
                expect(queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([]);
                    intermediateResults.push(1);
                    return 1;
                })).eventually.eq(1),
                expect(queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([1]);
                    throw new Error('Wrong');
                })).eventually.be.rejectedWith(Error),
                expect(queue.addTask(async () => {
                    await sleep(1000);
                    expect(intermediateResults).deep.eq([1]);
                    intermediateResults.push(3);
                    return 3;
                })).eventually.eq(3),
            ]);
        });
    });
});

const sleep = async (time: number): Promise<void> => new Promise(resolve => setTimeout(resolve, time));