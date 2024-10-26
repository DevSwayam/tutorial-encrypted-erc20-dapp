import React from "react";
import { useState, useEffect } from "react";
import { getFhevmInstance as getInstance, provider } from "./utils/fhevm";
import { toHexString } from "./utils/utils";
import { Contract, ethers } from "ethers";
import erc20ABI from "./abi/erc20ABI";

//STEP 3:
// TODO: Replace Contract Address
const CONTRACT_ADDRESS = "0x0EC4C38C37320Cd16c7eFFFFDfa778C5534b7F33";

function ConfidentialERC20() {
  const [amountMint, setAmountMint] = useState(0);
  const [loading, setLoading] = useState("");
  const [dialog, setDialog] = useState("");
  const [encryptedData, setEncryptedData] = useState("");
  const [userBalance, setUserBalance] = useState("hidden");
  const [instance, setInstance] = useState(null);

  useEffect(() => {
    async function fetchInstance() {
      const instance = await getInstance();
      setInstance(instance);
    }
    fetchInstance();
  }, []);

  const handleAmountMintChange = (e) => {
    setAmountMint(e.target.value);
  };

  const mint = async (event) => {
    event.preventDefault();
    try {
      setDialog("");
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, [{
        "inputs": [
          {
            "internalType": "einput",
            "name": "encryptedAmount",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "inputProof",
            "type": "bytes"
          }
        ],
        "name": "_mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },], signer);

      const input = await instance.createEncryptedInput(
        CONTRACT_ADDRESS,
        await signer.getAddress()
      );
      input.add64(ethers.parseUnits(amountMint.toString(), 6));
      const encryptedInput = input.encrypt();

      console.log(encryptedInput)


      setLoading('Encrypting "30" and generating ZK proof...');
      setLoading("Sending transaction...");

      //STEP 6:
      //TODO: Call mint() function on the smart contract
      console.log(contract)
      const transaction = await contract._mint(
        encryptedInput.handles[0],
        "0x" + toHexString(encryptedInput.inputProof)
      );
      setLoading("Waiting for transaction validation...");

      await provider.waitForTransaction(transaction.hash);
      setLoading("");
      setDialog("Tokens have been minted!");
    } catch (e) {
      console.log(e);
      setLoading("");
      setDialog("Transaction error!");
    }
  };

  const reencrypt = async () => {
    try {
      setDialog("");
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, erc20ABI, signer);
      setLoading("Decrypting total supply...");

      const balanceHandle = await contract.balanceOf(await signer.getAddress());

      //STEP 7:
      //TODO: Generate a temporary keypair along with a signature in order to decrypt the balance
      const { publicKey, privateKey } = instance.generateKeypair();
      const eip712 = instance.createEIP712(publicKey, CONTRACT_ADDRESS);

      const signature = await signer.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      console.log("balanceHandle", balanceHandle);
      if (balanceHandle.toString() === "0") {
        console.log("user has 0 balance");
        setUserBalance("0");
      } else {
        const balanceResult = await instance.reencrypt(
          balanceHandle,
          privateKey,
          publicKey,
          signature.replace("0x", ""),
          CONTRACT_ADDRESS,
          await signer.getAddress()
        );


        setUserBalance(balanceResult.toString());
        console.log(balanceResult.toString());
      }

      setLoading("");
    } catch (e) {
      console.log(e);
      setLoading("");
      setDialog("Error during reencrypt!");
      setUserBalance("Error");
    }
  };

  return (
    <div className="mt-5">
      <div className="flex flex-col text-center justify-center items-center mb-10 mt-10">
        <img src={"/band.svg"} alt="Band" />
        <h1 className="my-10 text-2xl font-bold text-gray-500">
          Confidential ERC20
        </h1>
        <img src={"/band.svg"} alt="Band" />
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="flex flex-col md:w-1/2 p-4">
          <div className="bg-black py-10 px-10 text-left mb-6">
            <div className="text-white">
              Name:{" "}
              <span className="text-custom-green">Confidential ERC-20</span>
            </div>
            <div className="text-white">
              Symbol: <span className="text-custom-green">CUSD</span>
            </div>
            <div className="text-white">
              Address:{" "}
              <span className="text-custom-green">
                {CONTRACT_ADDRESS.substring(0, 5) +
                  "..." +
                  CONTRACT_ADDRESS.substring(
                    CONTRACT_ADDRESS.length - 5,
                    CONTRACT_ADDRESS.length
                  )}
              </span>
            </div>
            <div className="text-white">
              Your Balance:{" "}
              <span className="text-custom-green">{userBalance && userBalance === 'hidden' ? 'hidden' : userBalance?.slice(0, -6) ? userBalance?.slice(0, -6) : '0'}</span>
            </div>
            <button
              className="bg-gray-200 hover:bg-blue-400 text-black font-bold py-2 px-4 rounded mb-8"
              onClick={reencrypt}
            >
              Decrypt own balance
            </button>
          </div>
          <form onSubmit={mint}>
            <input
              type="number"
              placeholder="Enter amount to mint"
              value={amountMint}
              onChange={handleAmountMintChange}
              className="border rounded-md px-4 py-2 mb-1 bg-white"
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-8"
            >
              Mint
            </button>
          </form>
          {encryptedData && (
            <div>
              <p className="text-gray-500">Generated Ciphertext:</p>
              <div className="text-gray-500 overflow-y-auto h-10 flex flex-col">
                <p>{"0x" + encryptedData.substring(0, 26) + "..."}</p>
              </div>
            </div>
          )}
          <div className="text-gray-500">
            {dialog && <div>{dialog}</div>}
            {loading && <div>{loading}</div>}
          </div>
        </div>
        <div className="flex flex-col md:w-1/2 p-4 overflow-y-auto h-96 bg-amber-300">
          <div className="text-lg">Code Snippets:</div>
          <br></br>
          <div className="text-sm">
            The user balances are stored on-chain and encrypted in the euint32
            format. An encrypted amount of tokens for the mint is generated on
            the client side and sent to the contract. The total supply is also
            encrypted.
          </div>
          <img src={"/CodeSvg1.svg"} alt="CodeSvg1" />
          <div className="text-sm">
            Users are able to view their own decrypted balances.
          </div>
          <img src={"/CodeSvg2.svg"} alt="CodeSvg2" />
          <div>
            Smart Contract Implementation:{" "}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://docs.inco.org/getting-started/example-dapps/erc-20"
            >
              Here
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfidentialERC20;
