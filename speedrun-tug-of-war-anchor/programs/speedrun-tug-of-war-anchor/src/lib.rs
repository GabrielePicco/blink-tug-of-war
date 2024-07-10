use anchor_lang::prelude::*;

declare_id!("tUGoFqTgp9KnR6qPUXuQ5WT83uL9xDZsoD5LCTEC4Cv");

pub const TUG_PDA_SEED: &[u8] = b"tug-pda";
pub const TUG_PDA_MANAGER: &[u8] = b"tug-manager";
pub const BET_PDA_SEED: &[u8] = b"bet";
pub const MAX_TUG: u16 = 250;

pub const FEE_PERCENT: u64 = 5;

#[program]
pub mod speedrun_tug_of_war_anchor {
    use super::*;
    use anchor_lang::solana_program::program::invoke;
    use anchor_lang::solana_program::system_instruction;

    pub fn initialize_manager(ctx: Context<InitializeManager>) -> Result<()> {
        ctx.accounts.manager.game = 0;
        Ok(())
    }

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let authority = ctx.accounts.payer.key.clone();
        ctx.accounts.tug.x = 0;
        ctx.accounts.tug.id = ctx.accounts.manager.game;
        ctx.accounts.tug.authority = authority;
        ctx.accounts.manager.game += 1;
        Ok(())
    }

    pub fn pull_left(ctx: Context<PullLeft>) -> Result<()> {
        let tug = &mut ctx.accounts.tug;
        if tug.is_game_on() {
            tug.x -= 1;
        }
        Ok(())
    }

    pub fn pull_right(ctx: Context<PullRight>) -> Result<()> {
        let tug = &mut ctx.accounts.tug;
        if tug.is_game_on() {
            tug.x += 1;
        }
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, side: Winner) -> Result<()> {
        let tug = &mut ctx.accounts.tug;

        if side == Winner::Left {
            tug.lamports_left += amount
        } else {
            tug.lamports_right += amount
        }

        // Transfer lamports from payer to manager
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.manager.key(),
            amount,
        );
        invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.manager.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Initialize the bet PDA
        let bet = &mut ctx.accounts.bet;
        bet.lamports = amount;
        bet.winner = side;

        Ok(())
    }

    pub fn claim_bet(ctx: Context<ClaimBet>) -> Result<()> {
        let tug = &ctx.accounts.tug;
        let bet = &ctx.accounts.bet;

        if tug.is_game_on() {
            return err!(TugError::GameIsNotOver);
        }

        if let Some(winning_side) = tug.winning_side() {
            if winning_side == bet.winner {
                let total_lamports = tug.lamports_left + tug.lamports_right;
                let fee = total_lamports * FEE_PERCENT / 100;
                let lamports_winning_side = match bet.winner {
                    Winner::Left => tug.lamports_left,
                    Winner::Right => tug.lamports_right,
                };
                let ratio = bet.lamports as f64 / lamports_winning_side as f64;
                let payout = (ratio * (total_lamports - fee) as f64) as u64;

                **ctx
                    .accounts
                    .manager
                    .to_account_info()
                    .try_borrow_mut_lamports()? -= payout;
                **ctx
                    .accounts
                    .payer
                    .to_account_info()
                    .try_borrow_mut_lamports()? += payout;
            }
        }

        Ok(())
    }
}

/// Context

#[derive(Accounts)]
pub struct InitializeManager<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer=payer, space = 10, seeds = [TUG_PDA_MANAGER], bump)]
    pub manager: Account<'info, Manager>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer=payer, space = 8 + Tug::INIT_SPACE, seeds = [TUG_PDA_SEED, manager.game.to_be_bytes().as_ref()], bump)]
    pub tug: Account<'info, Tug>,
    #[account(mut, seeds = [TUG_PDA_MANAGER], bump)]
    pub manager: Account<'info, Manager>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PullLeft<'info> {
    #[account(mut, seeds = [TUG_PDA_SEED, tug.id.to_be_bytes().as_ref()], bump)]
    pub tug: Account<'info, Tug>,
}

#[derive(Accounts)]
pub struct PullRight<'info> {
    #[account(mut, seeds = [TUG_PDA_SEED, tug.id.to_be_bytes().as_ref()], bump)]
    pub tug: Account<'info, Tug>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [TUG_PDA_SEED, tug.id.to_be_bytes().as_ref()], bump)]
    pub tug: Account<'info, Tug>,
    #[account(mut, seeds = [TUG_PDA_MANAGER], bump)]
    pub manager: Account<'info, Manager>,
    #[account(init, payer=payer, space = 8 + Bet::INIT_SPACE, seeds = [BET_PDA_SEED, payer.key().as_ref(), tug.key().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [TUG_PDA_SEED, tug.id.to_be_bytes().as_ref()], bump)]
    pub tug: Account<'info, Tug>,
    #[account(mut, seeds = [TUG_PDA_MANAGER], bump)]
    pub manager: Account<'info, Manager>,
    #[account(mut, close = payer, seeds = [BET_PDA_SEED, payer.key().as_ref(), tug.key().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
}

/// Accounts

#[account]
pub struct Manager {
    pub game: u16,
}

#[account]
#[derive(InitSpace)]
pub struct Tug {
    pub x: i16,
    pub id: u16,
    pub authority: Pubkey,
    pub lamports_left: u64,
    pub lamports_right: u64,
}

impl Tug {
    pub fn is_game_on(&self) -> bool {
        self.x < MAX_TUG as i16 && self.x > -(MAX_TUG as i16)
    }

    pub fn winning_side(&self) -> Option<Winner> {
        return if self.x >= MAX_TUG as i16 {
            Some(Winner::Right)
        } else if self.x <= -(MAX_TUG as i16) {
            Some(Winner::Right)
        } else {
            None
        };
    }
}

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub lamports: u64,
    pub winner: Winner,
}

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Winner {
    Left,
    Right,
}

#[error_code]
pub enum TugError {
    #[msg("The Game is not over")]
    GameIsNotOver,
}
