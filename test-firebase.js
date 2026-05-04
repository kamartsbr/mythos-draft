import { initializeApp } from 'firebase/app';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

const st = serverTimestamp();
console.log("serverTimestamp proto:", Object.getPrototypeOf(st) === Object.prototype);
console.log("serverTimestamp constructor:", st.constructor.name);
console.log("serverTimestamp fields:", Object.keys(st));
console.log("serverTimestamp JSON:", JSON.stringify(st));

const ts = Timestamp.now();
console.log("Timestamp proto:", Object.getPrototypeOf(ts) === Object.prototype);
console.log("Timestamp constructor:", ts.constructor.name);
console.log("Timestamp JSON:", JSON.stringify(ts));
