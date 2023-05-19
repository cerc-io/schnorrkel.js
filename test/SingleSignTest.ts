import { config, ethers } from 'hardhat';
import secp256k1 from 'secp256k1'
import { Schnorrkel } from '..'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai';
const ERC1271_MAGICVALUE_BYTES32 = '0x1626ba7e';
const schnorrkel = new Schnorrkel();

describe('Single Sign Tests', function () {
  const entryPoint = '0x0000000000000000000000000000000000000000';
  async function deployContract() {
    const SchnorrAccountAbstraction = await ethers.getContractFactory('SchnorrAccountAbstraction');

    // the private key
    const accounts: any = config.networks.hardhat.accounts
    const accountIndex = 0
    const wallet = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${accountIndex}`)
    const privateKey = ethers.utils.arrayify(wallet.privateKey);

    // the eth address
    const publicKey = secp256k1.publicKeyCreate(privateKey);
    const px = publicKey.slice(1, 33);
    const pxGeneratedAddress = ethers.utils.hexlify(px);
    const address = '0x' + pxGeneratedAddress.slice(pxGeneratedAddress.length - 40, pxGeneratedAddress.length);

    // deploying the contract
    const contract = await SchnorrAccountAbstraction.deploy(entryPoint, [address]);
    const isSigner = await contract.canSign(address);
    expect(isSigner).to.equal('0x0000000000000000000000000000000000000000000000000000000000000001');

    return { contract };
  }

  it('should generate a schnorr signature and verify onchain', async function () {
    const { contract } = await loadFixture(deployContract);

    // get the public key
    const accounts: any = config.networks.hardhat.accounts
    const accountIndex = 0
    const wallet = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${accountIndex}`)
    const privateKey = ethers.utils.arrayify(wallet.privateKey);
    const publicKey = secp256k1.publicKeyCreate(privateKey);

    // sign
    const msg = 'just a test message';
    const sig = schnorrkel.sign(privateKey, msg);

    // wrap the result
    const px = publicKey.slice(1, 33);
    const parity = publicKey[0] - 2 + 27;
    const abiCoder = new ethers.utils.AbiCoder();
    const sigData = abiCoder.encode([ 'bytes32', 'bytes32', 'bytes32', 'uint8' ], [
      px,
      sig.e,
      sig.s,
      parity
    ]);
    const msgHash = ethers.utils.solidityKeccak256(['string'], [msg]);
    const result = await contract.isValidSignature(msgHash, sigData);
    expect(result).to.equal(ERC1271_MAGICVALUE_BYTES32);
  })

  it('should generate a schnorr signature and verify offchain', async function () {
    // get the Private key
    const accounts: any = config.networks.hardhat.accounts
    const accountIndex = 0
    const wallet = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${accountIndex}`)
    const privateKey = ethers.utils.arrayify(wallet.privateKey);
    const publicKey = secp256k1.publicKeyCreate(privateKey);

    // get the message
    const msg = 'just a test message';
    const {R, s} = schnorrkel.sign(privateKey, msg);
    const result = schnorrkel.verify(s, msg, R, publicKey);
    expect(result).to.equal(true);
  })
});