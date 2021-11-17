const { ether } = require('@openzeppelin/test-helpers');
const { create, all } = require('mathjs')
const {expect} = require("chai");
const config = {}
const mathjs = create(all, config)

const tokens = (x) => {
    return ether(x).toString()
}

const fromWei = (x) => {
    return ethers.utils.formatEther(x)
}

const toTokens = (value, decimals = 18) => {
    return mathjs.format(
        mathjs.multiply(value, mathjs.pow(10, decimals)),
        {
            notation: 'fixed'
        }
    )
}

const fromTokens = (value, decimals = 18, round = false) => {
    let result = mathjs.divide(value.toString(), mathjs.pow(10, decimals))
    if(round){
        result = mathjs.round(result, 2)
    }
    return result.toString()
}

const increaseTime = async (x) => {
    await ethers.provider.send('evm_increaseTime', [x])
    await ethers.provider.send('evm_mine')
}

const advanceBlock = async (x) => {
    for(let i=0; i<x; i++){
        await ethers.provider.send('evm_mine')
    }
}

const getTime = async () => {
    const latestBlock = await ethers.provider.getBlock('latest')
    return latestBlock.timestamp
}

const keccak256 = (x) => {
    return ethers.utils.keccak256(x)
}

const toUtf8Bytes = (x) => {
    return ethers.utils.toUtf8Bytes(x)
}

const getEventsFromTransaction = async (transaction) => {
    let result = []
    const receipt = await transaction.wait()
    for(let x in receipt.events){
        result.push({
            eventName: receipt.events[x].event,
            args: []
        })
        for(let y in receipt.events[x].args){
            result[x].args[y] = receipt.events[x].args[y].toString()
        }
    }
    return result
}

const hasEmittedEvent = async function (promise, expectedEvent, expectedParams = {}) {
    promise.catch(() => { }); // Avoids uncaught promise rejections in case an input validation causes us to return early

    if (!expectedEvent) {
        throw Error('No event specified');
    }

    const receipt = await (await promise).wait()
    let eventNamePresent = false
    for(let x in receipt.events){
        if(receipt.events[x].event == expectedEvent){
            eventNamePresent = true
            for(let y in expectedParams){
                expect(receipt.events[x].args, 'Emmited event "'+ expectedEvent +'" doesn\'t contain expected property "'+ y +'" with value "'+ expectedParams[y] +'"')
                    .to.has.property(y)
                    .that.is.eq(expectedParams[y])
            }
            break
        }
    }
    expect(eventNamePresent).to.equal(true, 'Transaction didn\'t emit "'+ expectedEvent +'" event')
}

const time = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    y: 31536000
}

module.exports = {
    tokens,
    fromWei,
    toTokens,
    fromTokens,
    increaseTime,
    advanceBlock,
    getTime,
    keccak256,
    toUtf8Bytes,
    getEventsFromTransaction,
    hasEmittedEvent,
    time
}
