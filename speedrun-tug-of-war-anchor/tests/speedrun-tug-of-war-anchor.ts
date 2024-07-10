import * as anchor from "@coral-xyz/anchor";
import {BN, Program} from "@coral-xyz/anchor";
import { SpeedrunTugOfWarAnchor } from "../target/types/speedrun_tug_of_war_anchor";

const TUG_PDA_SEED = "tug-pda";
const TUG_PDA_MANAGER = "tug-manager";

describe("speedrun-tug-of-war-anchor", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SpeedrunTugOfWarAnchor as Program<SpeedrunTugOfWarAnchor>;

  const [managerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(TUG_PDA_MANAGER)],
      program.programId
  );

  let pda: anchor.Address;

  it.only("Initializes the game manager if it is not already initialized.", async () => {
    const managerAccountInfo = await provider.connection.getAccountInfo(managerPda);
    if (managerAccountInfo === null) {
      const tx = await program.methods
          .initializeManager()
          .accounts({
            payer: provider.wallet.publicKey,
          })
          .rpc({ skipPreflight: true });
      console.log("Init Pda Manager Pda Tx: ", tx);
    }
  });

  it.only("Initializes the game if it is not already initialized.", async () => {
    const managerAccount = await program.account.manager.fetch(managerPda);
    const gameId = new BN(managerAccount.game);
    [pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(TUG_PDA_SEED), Buffer.from(gameId.toArrayLike(Buffer, "be", 2))],
        program.programId
    );

    const tugAccountInfo = await provider.connection.getAccountInfo(pda);
    if (tugAccountInfo === null) {
      const tx = await program.methods
        .initialize()
        .accounts({
          payer: provider.wallet.publicKey,
        })
        .rpc({ skipPreflight: true });
      console.log("Init Pda Tx: ", tx);
    }

    const tugAccount = await program.account.tug.fetch(pda);
    console.log("Tug: ", tugAccount.x.toString());
  });

  it("Pull Left", async () => {
    const tx = await program.methods
      .pullLeft()
      .accounts({
        tug: pda,
      })
      .rpc({ skipPreflight: true });
    console.log("Pull Left Tx: ", tx);
    const tugAccount = await program.account.tug.fetch(pda);
    console.log("Tug: ", tugAccount.x.toString());
  });

  it("Pull Right", async () => {
    const tx = await program.methods
      .pullRight()
      .accounts({
        tug: pda,
      })
      .rpc({ skipPreflight: true });
    console.log("Pull Right Tx: ", tx);
    const tugAccount = await program.account.tug.fetch(pda);
    console.log("Tug: ", tugAccount.x.toString());
  });

  it("Place Bet Right", async () => {
    const tx = await program.methods
        // @ts-ignore
        .placeBet(new BN(10000), { right: {} })
        .accounts({
          payer: provider.publicKey,
          // @ts-ignore
          tug: pda
        })
        .rpc({ skipPreflight: true });
    console.log("Place Bet Right Tx: ", tx);
    const tugAccount = await program.account.tug.fetch(pda);
    console.log(JSON.stringify(tugAccount));
  });

  it("Place Bet Left", async () => {
    const user1KP = anchor.web3.Keypair.generate();
    let token_airdrop = await provider.connection.requestAirdrop(user1KP.publicKey,
        10000000000);
    const latestBlockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: token_airdrop,
    });

    const tx = await program.methods
        // @ts-ignore
        .placeBet(new BN(1000000), { left: {} })
        .accounts({
          payer: user1KP.publicKey,
          // @ts-ignore
          tug: pda
        })
        .signers([user1KP])
        .rpc({ skipPreflight: true });
    console.log("Place Bet Right Tx: ", tx);
    const tugAccount = await program.account.tug.fetch(pda);
    console.log(JSON.stringify(tugAccount));
  });

  it("Claim Bet", async () => {
    try{
      const tx = await program.methods
          // @ts-ignore
          .claimBet()
          .accounts({
            payer: provider.publicKey,
            // @ts-ignore
            tug: pda
          })
          .rpc({ skipPreflight: true });
      console.log("Claim Bet Tx: ", tx);
      const tugAccount = await program.account.tug.fetch(pda);
      console.log(JSON.stringify(tugAccount));
    }catch (e){
      console.log("Correctly failing with: ", e.toString())
    }
  });

});
