import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "./components/Button";
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Alert from "./components/Alert";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN, Program, Provider } from "@coral-xyz/anchor";
import { SimpleProvider } from "./components/Wallet";

const TUG_PDA_SEED = "tug-pda";
const TUG_PDA_MANAGER = "tug-manager";
const TUG_PROGRAM = new PublicKey("tUGoFqTgp9KnR6qPUXuQ5WT83uL9xDZsoD5LCTEC4Cv");

const App: React.FC = () => {
    let { connection } = useConnection();
    const provider = useRef<Provider>(new SimpleProvider(connection));
    const { publicKey, sendTransaction } = useWallet();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [transactionError, setTransactionError] = useState<string | null>(null);
    const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);
    const [isClientInitialized, setIsClientInitialized] = useState<boolean>(false);
    const [gameId, setGameId] = useState<PublicKey | null>(null);

    const tugProgramClient = useRef<Program | null>(null);

    // Helpers to Dynamically fetch the IDL and initialize the program client
    const getProgramClient = useCallback(async (component: PublicKey): Promise<Program> => {
        const idl = await Program.fetchIdl(component, provider.current);
        if (!idl) throw new Error('IDL not found');
        return new Program(idl, provider.current);
    }, [provider]);

    useEffect(() => {
        const initializeProgramClient = async () => {
            tugProgramClient.current = await getProgramClient(TUG_PROGRAM);
            setIsClientInitialized(true);
        };
        initializeProgramClient().catch(console.error);
    }, [connection, getProgramClient]);

    const submitTransaction = useCallback(async (transaction: Transaction): Promise<string | null> => {
        if (isSubmitting) return null;
        setIsSubmitting(true);
        setTransactionError(null);
        setTransactionSuccess(null);
        try {
            const {
                context: { slot: minContextSlot },
                value: { blockhash, lastValidBlockHeight }
            } = await connection.getLatestBlockhashAndContext();

            const signature = await sendTransaction(transaction, connection, { minContextSlot });
            await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature }, "confirmed");

            // Transaction was successful
            console.log(`Transaction confirmed: ${signature}`);
            setTransactionSuccess(`Transaction confirmed`);
            return signature;
        } catch (error) {
            setTransactionError(`Transaction failed: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
        return null;
    }, [connection, isSubmitting, sendTransaction]);

    /**
     * Create a new game transaction
     */
    const newGameTx = useCallback(async () => {
        if (!publicKey) throw new WalletNotConnectedError();
        if (!isClientInitialized || !tugProgramClient.current) throw new Error("Program client is not initialized");

        const [managerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(TUG_PDA_MANAGER)],
            TUG_PROGRAM
        );
        // @ts-ignore
        const managerAccount = await tugProgramClient.current?.account.manager.fetch(managerPda);
        console.log(managerAccount);
        const gameId = new BN(managerAccount?.game);
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from(TUG_PDA_SEED), Buffer.from(gameId.toArrayLike(Buffer, "be", 2))],
            TUG_PROGRAM
        );

        const transaction = await tugProgramClient.current?.methods
            .initialize()
            .accounts({
                payer: publicKey,
                tug: pda
            }).transaction() as Transaction;

        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const signature = await submitTransaction(transaction) as string;
        setGameId(pda);
    }, [connection, publicKey, submitTransaction, isClientInitialized]);

    return (
        <div className="tug-of-war">
            <div className="wallet-buttons">
                <WalletMultiButton />
            </div>

            <h1> CREATE A TUG OF WAR BLINK </h1>

            <Button title={"Create Blink"} resetGame={newGameTx} />
            <div className="join-game">
                <input
                    style={{ width: '40rem' }}
                    type="text"
                    placeholder="Blink URL"
                    value={"https://tug-of-war.magicblock.app/api/v1/tug/item/" + (gameId?.toBase58() ?? "{...}")}
                    readOnly
                />
            </div>

            {isSubmitting && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    position: 'fixed',
                    bottom: '20px',
                    left: 0,
                    width: '100%',
                    zIndex: 1000,
                }}>
                    <div className="spinner"></div>
                </div>
            )}

            {transactionError &&
                <Alert type="error" message={transactionError} onClose={() => setTransactionError(null)} />}

            {transactionSuccess &&
                <Alert type="success" message={transactionSuccess} onClose={() => setTransactionSuccess(null)} />}

            <img src={`${process.env.PUBLIC_URL}/blink.jpg`} width={'400px'} style={{ marginTop: '30px' }}
                 alt="Blink Preview" />
        </div>
    );
};

export default App;
