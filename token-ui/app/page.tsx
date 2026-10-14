"use client";
import {useEffect, useRef, useState} from "react";
import {Web3} from "web3";
import abi from "../lib/abi.json";
import deployment from "../lib/deployment.json";
import {parseAmount, formatAmount} from "../lib/amount";

type Provider = {
  request(args: {method:string;params?:unknown}): Promise<unknown>;
  on?(event:string, listener:()=>void): void;
  removeListener?(event:string, listener:()=>void): void;
};
type TokenInfo = {name:string;symbol:string;decimals:number;owner:string;balance:bigint;supply:bigint};
const address = deployment.address;
function wallet(): Provider {
  const p = (window as unknown as {ethereum?:Provider}).ethereum;
  if (!p) throw Error("Откройте приложение в Chrome с установленным MetaMask.");
  return p;
}
async function session() {
  const p = wallet();
  if (await p.request({method:"eth_chainId"}) !== "0xaa36a7") {
    await p.request({method:"wallet_switchEthereumChain",params:[{chainId:"0xaa36a7"}]});
  }
  if (await p.request({method:"eth_chainId"}) !== "0xaa36a7") throw Error("Для этой лабораторной выберите Ethereum Sepolia.");
  const accounts = await p.request({method:"eth_requestAccounts"}) as string[];
  if (!accounts[0]) throw Error("Разрешите подключение аккаунта в MetaMask.");
  const web3 = new Web3(p as never);
  if (await web3.eth.getCode(address) === "0x") throw Error("Контракт не найден в Sepolia.");
  return {p, web3, account:accounts[0], token:new web3.eth.Contract(abi,address)};
}
export default function Page() {
  const [account,setAccount] = useState("");
  const [info,setInfo] = useState<TokenInfo|null>(null);
  const [recipient,setRecipient] = useState("");
  const [amount,setAmount] = useState("");
  const [mintTo,setMintTo] = useState("");
  const [mintAmount,setMintAmount] = useState("");
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState("");
  const [error,setError] = useState(false);
  const [hash,setHash] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const p = (window as unknown as {ethereum?:Provider}).ethereum;
    const reset = () => {generation.current++;setInfo(null);setAccount("");};
    p?.on?.("accountsChanged",reset);p?.on?.("chainChanged",reset);
    return () => {p?.removeListener?.("accountsChanged",reset);p?.removeListener?.("chainChanged",reset);};
  },[]);
  async function refresh(s:Awaited<ReturnType<typeof session>>) {
    const version = generation.current;
    const [name,symbol,decimals,owner,balance,supply] = await Promise.all([
      s.token.methods.name().call(),s.token.methods.symbol().call(),s.token.methods.decimals().call(),
      s.token.methods.owner().call(),s.token.methods.balanceOf(s.account).call(),s.token.methods.totalSupply().call(),
    ]);
    if (generation.current !== version) throw Error("Аккаунт или сеть изменились. Подключите кошелёк заново.");
    const data = {name:String(name),symbol:String(symbol),decimals:Number(decimals),owner:String(owner),balance:BigInt(String(balance)),supply:BigInt(String(supply))};
    setInfo(data);setAccount(s.account);return data;
  }
  async function run(fn:()=>Promise<void>) {
    setBusy(true);setError(false);setStatus("");
    try {await fn();} catch(e) {setError(true);setStatus(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false);}
  }
  async function connect() {await run(async()=>{await refresh(await session());setStatus("Баланс обновлён. Подключена Ethereum Sepolia.");});}
  async function send(mint:boolean) {
    await run(async()=>{
      const s = await session();const data = await refresh(s);
      const version = generation.current;
      const to = (mint ? mintTo : recipient).trim();
      if (!s.web3.utils.isAddress(to) || /^0x0{40}$/i.test(to)) throw Error("Введите ненулевой Ethereum-адрес получателя.");
      const value = parseAmount(mint ? mintAmount : amount,data.decimals);
      if (mint && s.account.toLowerCase() !== data.owner.toLowerCase()) throw Error("Только владелец контракта может чеканить токены.");
      if (!mint && value > data.balance) throw Error("На аккаунте недостаточно KWN.");
      const method = mint ? s.token.methods.mint(to,value) : s.token.methods.transfer(to,value);
      await method.call({from:s.account});
      if (version !== generation.current) throw Error("Аккаунт или сеть изменились. Повторите подключение.");
      setStatus("Подтвердите операцию в MetaMask.");
      const tx = await s.p.request({method:"eth_sendTransaction",params:[{from:s.account,to:address,data:method.encodeABI()}]}) as string;
      setHash(tx);setStatus("Транзакция отправлена. Ожидаем подтверждения…");
      for(let i=0;i<90;i++) {
        if (version !== generation.current) {setStatus("Аккаунт или сеть изменились. Результат отправленной транзакции доступен по ссылке ниже.");return;}
        const receipt = await s.web3.eth.getTransactionReceipt(tx).catch(()=>null);
        if (receipt) {
          if (BigInt(receipt.status) !== 1n) throw Error("Транзакция не выполнена. Проверьте причину в Etherscan.");
          setStatus("Транзакция подтверждена.");
          try {await refresh(s);} catch {setStatus("Транзакция подтверждена. Не удалось обновить баланс — нажмите «Обновить баланс».");}
          return;
        }
        await new Promise(resolve=>setTimeout(resolve,2000));
      }
      setStatus("Подтверждение пока не получено. Проверьте транзакцию в Etherscan перед повторной отправкой.");
    });
  }
  async function addToken() {await run(async()=>{
    const s = await session();const data = await refresh(s);
    const accepted = await s.p.request({method:"wallet_watchAsset",params:{type:"ERC20",options:{address,symbol:data.symbol,decimals:data.decimals}}});
    setStatus(accepted ? "Токен добавлен в MetaMask." : "Добавление токена отменено.");
  });}
  const isOwner = !!info && account.toLowerCase() === info.owner.toLowerCase();
  return <main>
    <header><span className="eyebrow">ЛАБОРАТОРНАЯ РАБОТА 3 · ERC-20</span><h1>KWNcoin</h1><p className="muted">Учебный токен в сети Ethereum Sepolia</p></header>
    <section><h2>Мой кошелёк</h2><div className="buttons"><button onClick={connect} disabled={busy}>{info?"Обновить баланс":"Подключить MetaMask"}</button>{info&&<button className="secondary" onClick={addToken} disabled={busy}>Добавить токен в MetaMask</button>}</div>
      {!info&&<p className="muted">Подключите кошелёк, чтобы увидеть баланс и выполнить операции.</p>}
      {info&&<><p><span className="badge">Sepolia · {isOwner?"Владелец контракта":"Пользователь"}</span></p><div className="balance">{formatAmount(info.balance,info.decimals)} {info.symbol}</div><p className="address">Ваш аккаунт: {account}</p><p>Всего выпущено: {formatAmount(info.supply,info.decimals)} {info.symbol}<br/>Точность: {info.decimals} знаков после запятой</p><p className="address muted">Владелец: {info.owner}</p></>}
      <p><a href={`https://sepolia.etherscan.io/address/${address}#code`} target="_blank" rel="noreferrer">Верифицированный контракт ↗</a></p>
    </section>
    <div className="grid"><section><h2>Перевести токены</h2><label>Адрес получателя<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="0x…"/></label><label>Количество KWN<input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Например, 1.5" inputMode="decimal"/></label><button onClick={()=>send(false)} disabled={busy||!info}>Перевести</button></section>
    {isOwner&&<section><h2>Чеканка токенов</h2><p className="muted">Доступна владельцу. Увеличивает общий выпуск.</p><label>Адрес получателя<input value={mintTo} onChange={e=>setMintTo(e.target.value)} placeholder="0x…"/></label><label>Количество новых KWN<input value={mintAmount} onChange={e=>setMintAmount(e.target.value)} placeholder="Например, 10" inputMode="decimal"/></label><button onClick={()=>send(true)} disabled={busy}>Выпустить токены</button></section>}</div>
    {(status||hash)&&<section className={error?"error":""} aria-live="polite"><p className="status">{status}</p>{hash&&<a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">Последняя отправленная транзакция ↗</a>}</section>}
    <footer>Переводы и чеканка подтверждаются в MetaMask. Комиссия оплачивается тестовыми SepoliaETH.</footer>
  </main>;
}
