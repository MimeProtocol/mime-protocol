import { getManager } from 'typeorm';
import { providers } from 'ethers';
import { FollowedTrader } from '../entities/FollowedTrader.entity';
import { WrappedNodeRedisClient } from 'handy-redis';
import { getTransactions } from '../utils/jsonRpcGetTransactions';

export async function filterAndQueueRelayableTxnsInBlock(
  blockNumber: number,
  provider: providers.Provider,
  redis: WrappedNodeRedisClient,
) {
  // Db connection.
  const followedTradersRepository = getManager().getRepository(FollowedTrader);

  // Get followed traders from db.
  const followedTraders = await followedTradersRepository
    .createQueryBuilder('entity')
    .select('entity.address')
    .getMany();
  const followedTradersAddresses = followedTraders.map(
    (trader) => trader.address,
  );

  // Load block details.
  const block = await provider.getBlockWithTransactions(blockNumber);

  // Load block transactions.
  const blockTransactions = await getTransactions(
    block.transactions.map((tx) => tx.hash),
    (await provider.getNetwork()).chainId,
  );

  // Filter matching txns.
  const matchingTransactions = blockTransactions.filter((tx) => {
    return followedTradersAddresses.includes(tx.from.toLocaleLowerCase());
  });

  console.log('Transactions to relay', matchingTransactions);

  for (const tx of matchingTransactions) {
    redis.set(tx.hash, JSON.stringify(tx));
  }
}
