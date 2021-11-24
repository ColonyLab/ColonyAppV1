import { BigNumberish } from "@ethersproject/bignumber";
import { ContractTransaction, Event } from "@ethersproject/contracts";
import { ethers } from "hardhat";

const { ether } = require('@openzeppelin/test-helpers');
const { create, all } = require('mathjs')
const {expect} = require("chai");
const config = {}
const mathjs = create(all, config)

export function tokens(x: string): string {
    return ether(x).toString()
}

export function fromWei (x: string): string {
    return ethers.utils.formatEther(x)
}

export function toTokens(value: BigNumberish, decimals = 18): string {
    return ethers.utils.parseUnits(value.toString(), decimals).toString()
}

export function fromTokens(value: BigNumberish, decimals = 18, round = false): string {
    let result = ethers.utils.formatUnits(value.toString(), decimals)
    if(round){
        result = mathjs.round(result, 2)
    }
    return result.toString()
}

export async function increaseTime(x: string | number): Promise<void> {
    await ethers.provider.send('evm_increaseTime', [x])
    await ethers.provider.send('evm_mine', [])
}

export async function advanceBlock(x: number): Promise<void> {
    for(let i=0; i<x; i++){
        await ethers.provider.send('evm_mine', [])
    }
}

export async function getTime(): Promise<number> {
    const latestBlock = await ethers.provider.getBlock('latest')
    return latestBlock.timestamp
}

export function keccak256(x: string): string {
    return ethers.utils.keccak256(x)
}

export function toUtf8Bytes(x: string): Uint8Array {
    return ethers.utils.toUtf8Bytes(x)
}

export async function hasEmittedEvent(promise: Promise<ContractTransaction>, expectedEvent: string, expectedParams = {}): Promise<void> {
    promise.catch(() => { }); // Avoids uncaught promise rejections in case an input validation causes us to return early

    if (!expectedEvent) {
        throw Error('No event specified');
    }

    const receipt = await (await promise).wait()
    let eventNamePresent = false
    if(receipt.events != undefined){
        for(const event of receipt.events){
            if(event.event == expectedEvent){
                eventNamePresent = true
                for(const [index, param] of Object.entries(expectedParams)){
                    expect(event.args, 'Emmited event "'+ expectedEvent +'" doesn\'t contain expected property "'+ index +'" with value "'+ param +'"')
                        .to.has.property(index)
                        .that.is.eq(param)
                }
                break
            }
        }
    }
    
    expect(eventNamePresent).to.equal(true, 'Transaction didn\'t emit "'+ expectedEvent +'" event')
}

export const time = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    y: 31536000
}
