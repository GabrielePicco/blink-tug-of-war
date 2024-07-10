import express, {Request, Response} from 'express';
import cors from 'cors';
import {PublicKey, Connection, clusterApiUrl} from '@solana/web3.js';
import {createPostResponse} from '@solana/actions';
import {BN, Program, Provider} from '@coral-xyz/anchor';

const app = express();
const endpoint: string = process.env.RPC_URL || clusterApiUrl('devnet');

class SimpleProvider implements Provider {
    readonly connection: Connection;
    readonly publicKey?: PublicKey;

    constructor(connection: Connection, publicKey?: PublicKey) {
        this.connection = connection;
        this.publicKey = publicKey;
    }
}

const connection = new Connection(endpoint);
const tugProgramId = new PublicKey('tUGoFqTgp9KnR6qPUXuQ5WT83uL9xDZsoD5LCTEC4Cv');

let tugProgram: Program;
let provider: SimpleProvider;

// Load the program from the IDL
async function initialize() {
    provider = new SimpleProvider(connection);
    const idl = await Program.fetchIdl(tugProgramId, provider);
    if (!idl) throw new Error('IDL not found');
    tugProgram = new Program(idl, provider);
}

app.use(cors());
app.use(express.json());

async function handlePull(req: Request, res: Response, direction: 'left' | 'right') {
    try {
        const {account: accountStr} = req.body;
        const {tug} = req.query;

        if (!accountStr) {
            return res.status(400).json({message: 'Account is required'});
        }

        let account: PublicKey;
        try {
            account = new PublicKey(accountStr);
        } catch (err) {
            return res.status(400).json({message: 'Invalid "account" provided'});
        }

        const methodName = direction === 'left' ? 'pullLeft' : 'pullRight';

        if (!(methodName in tugProgram.methods)) {
            return res.status(400).json({message: `Method ${methodName} not found in tugProgram`});
        }

        const transaction = await (tugProgram.methods as any)[methodName]().accounts({
            tug: tug,
        }).transaction();

        transaction.feePayer = account;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const payload = await createPostResponse({
            fields: {
                transaction,
                message: `Pull ${direction}`,
            },
            signers: [],
        });

        res.json(payload);
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        res.status(400).json({error: errorMessage});
    }
}

async function handleBet(req: Request, res: Response, direction: 'left' | 'right') {
    try {
        const {account: accountStr} = req.body;
        const {tug, amount} = req.query;

        const amountBN = new BN(parseFloat(amount as string) * 10 ^ 9);

        if (!accountStr) {
            return res.status(400).json({message: 'Account is required'});
        }

        let account: PublicKey;
        try {
            account = new PublicKey(accountStr);
        } catch (err) {
            return res.status(400).json({message: 'Invalid "account" provided'});
        }

        const transaction = await tugProgram.methods.placeBet(amountBN, {[direction]: {}}).accounts({
            payer: account,
            tug: tug,
        }).transaction();

        transaction.feePayer = account;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const payload = await createPostResponse({
            fields: {
                transaction,
                message: `Place bet on ${direction}`,
            },
            signers: [],
        });

        res.json(payload);
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        res.status(400).json({error: errorMessage});
    }
}

async function handleClaim(req: Request, res: Response) {
    try {
        const {account: accountStr} = req.body;
        const {tug} = req.query;

        if (!accountStr) {
            return res.status(400).json({message: 'Account is required'});
        }

        let account: PublicKey;
        try {
            account = new PublicKey(accountStr);
        } catch (err) {
            return res.status(400).json({message: 'Invalid "account" provided'});
        }

        const transaction = await tugProgram.methods.claimBet().accounts({
            payer: account,
            tug: tug,
        }).transaction();

        transaction.feePayer = account;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const payload = await createPostResponse({
            fields: {
                transaction,
                message: `Claiming reward (if any) and closing the bet account`,
            },
            signers: [],
        });

        res.json(payload);
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        res.status(400).json({error: errorMessage});
    }
}

app.post('/pull-left', (req: Request, res: Response) => handlePull(req, res, 'left'));

app.post('/pull-right', (req: Request, res: Response) => handlePull(req, res, 'right'));

app.post('/bet-left', (req: Request, res: Response) => handleBet(req, res, 'left'));

app.post('/bet-right', (req: Request, res: Response) => handleBet(req, res, 'right'));

app.post('/claim', (req: Request, res: Response) => handleClaim(req, res));

initialize().then(() => {
    app.listen(3000, () => {
        console.log('Listening on port 3000..., endpoint:', endpoint, 'tugProgramId:', tugProgramId.toBase58());
    });
}).catch(err => {
    console.error('Failed to initialize program:', err instanceof Error ? err.message : 'An unknown error occurred');
    process.exit(1);
});
