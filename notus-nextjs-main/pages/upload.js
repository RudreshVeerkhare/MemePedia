import React, { useState, useContext, useEffect } from "react";

// components

import CardSettings from "components/Cards/CardSettings.js";
import CardProfile from "components/Cards/CardProfile.js";
import Navbar from "components/Navbars/AuthNavbar.js";
import Modal from "components/Modal/Modal";
import Web3Context from "context/Web3Context";
import { create } from "ipfs-http-client";
import axios from "axios";
import IpfsHash from "ipfs-only-hash";

let items = ["Item 1", "Item 1", "Item 1"];
const ipfs = create({
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https",
});

const NFTCard = ({ imageUrl, title, description, openseaUrl, tokenId }) => {
    return (
        <a href={openseaUrl} target="_blank">
            <div className="w-full mt-10 px-4">
                <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded-lg bg-blueGray-700">
                    <img
                        alt="..."
                        src={imageUrl}
                        className="w-full align-middle rounded-t-lg"
                    />
                    <blockquote className="relative p-8 mb-4">
                        <svg
                            preserveAspectRatio="none"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 583 95"
                            className="absolute left-0 w-full block h-95-px -top-94-px"
                        >
                            <polygon
                                points="-30,95 583,95 583,65"
                                className="text-blueGray-700 fill-current"
                            ></polygon>
                        </svg>
                        <h4 className="text-xl font-bold text-white">
                            {title} ({tokenId})
                        </h4>
                        <p className="text-md font-light mt-2 text-white">
                            {description}
                        </p>
                    </blockquote>
                </div>
            </div>
        </a>
    );
};

const NFTObject = (
    tokenId,
    title,
    description,
    ipfsUrl,
    openseaUrl,
    embeddings
) => {
    return {
        tokenId,
        title,
        description,
        ipfsUrl,
        openseaUrl,
        embeddings,
    };
};

const cosinesim = (A, B) => {
    var dotproduct = 0;
    var mA = 0;
    var mB = 0;
    var i;
    for (i = 0; i < A.length; i++) {
        // here you missed the i++
        dotproduct += A[i] * B[i];
        mA += A[i] * A[i];
        mB += B[i] * B[i];
    }
    mA = Math.sqrt(mA);
    mB = Math.sqrt(mB);
    var similarity = dotproduct / (mA * mB); // here you needed extra brackets
    return similarity;
};

const NFTS = ({ targetEmbeddings, imageFile, allowed, setAllowed }) => {
    const [nfts, setNfts] = useState([]);
    const [similar, setSimilar] = useState([]);

    //=======================Loading Context========================
    const { web3, accounts, contract } = useContext(Web3Context);
    //==============================================================

    const getNftMeta = async (address, tokenId) => {
        const config = {
            method: "get",
            url: `https://deep-index.moralis.io/api/v2/nft/${address}/${tokenId}?chain=mumbai&format=decimal`,
            headers: {
                Accept: "application/json",
                "x-api-key": `${process.env.REACT_APP_MORALIS_NFT_API}`,
            },
        };

        const response = await axios(config);
        console.log({ res: response.data });
        let metadata = JSON.parse(response.data.metadata);
        if (!metadata) {
            const _res = await axios.get(response.data.token_uri);
            console.log({ res: _res.data });
            metadata = _res.data;
        }

        return NFTObject(
            tokenId,
            metadata.name,
            metadata.description,
            metadata.image,
            `https://testnets.opensea.io/assets/mumbai/${address}/${tokenId}`,
            JSON.parse(metadata.encodings)
        );
    };

    // console.log({ web3, accounts, contract });
    useEffect(() => {
        // load nft counts
        const init = async () => {
            setSimilar([]);
            // get NFT count
            const count = await contract.methods._tokenIds().call();
            console.log({ count });
            const nfts = [];

            // loop through all NFTS

            for (let i = 1; i <= count; i++) {
                nfts.push(await getNftMeta(contract._address, i));
            }

            console.log(imageFile);
            const reader = new window.FileReader();
            reader.readAsArrayBuffer(imageFile);
            reader.onloadend = async () => {
                console.log({ nfts });
                const targetIpfsHash = await IpfsHash.of(Buffer(reader.result));
                console.log({ targetIpfsHash });
                for (let i = 0; i < nfts.length; i++) {
                    const nft = nfts[i];
                    const parts = nft.ipfsUrl
                        .split("/")
                        .filter((elm) => elm !== "");
                    console.log(parts);
                    const _match = targetIpfsHash == parts[parts.length - 1];
                    if (_match) {
                        alert("Same Image Already Exisits");
                        console.log({ nft });
                        setAllowed(false);
                        return;
                    }
                }

                setSimilar([
                    ...nfts.filter((nft) => {
                        // find cosine sim with target
                        const sim = cosinesim(targetEmbeddings, nft.embeddings);
                        console.log({ sim });
                        console.log(sim >= 0.6);
                        return sim >= 0.6;
                    }),
                ]);
                console.log({ similar });
            };
        };

        if (contract) init();
    }, [web3, accounts, contract, imageFile]);

    return (
        <>
            <div className="container px-4 mx-auto">
                <div className="flex flex-wrap">
                    {similar.map((nft, index) => (
                        <div className="w-full px-4 flex-1">
                            <NFTCard
                                title={
                                    nft.title +
                                    " " +
                                    cosinesim(targetEmbeddings, nft.embeddings)
                                }
                                imageUrl={nft.ipfsUrl}
                                description={nft.description}
                                openseaUrl={nft.openseaUrl}
                                tokenId={nft.tokenId}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

const getImageReport = async (image) => {
    const formData = new FormData();
    formData.append("image", image);
    const response = await axios.post(
        "http://127.0.0.1:5000/embeddings",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );

    return {
        embeddings: response.data.embeddings,
        adult: response.data.adult,
        violence: response.data.violence,
        racy: response.data.racy,
    };
};

export default function Upload() {
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [modelContent, setModalContent] = useState({});
    const [image, setImage] = useState();
    const [targetEmbedding, setTargetEmbedding] = useState([]);
    const { web3, accounts, contract } = useContext(Web3Context);
    const [allowed, setAllowed] = useState(true);

    useEffect(() => {
        if (image)
            getImageReport(image).then(
                ({ embeddings, adult, violence, racy }) => {
                    setModalContent({ adult, violence, racy });
                    if (
                        adult === "VERY_LIKELY" ||
                        violence === "VERY_LIKELY" ||
                        racy === "VERY_LIKELY"
                    ) {
                        setAllowed(false);
                    }
                    setShowModal(true);
                    console.log("Here");
                    console.log({ embeddings });
                    setTargetEmbedding([...embeddings]);
                }
            );
    }, [image]);

    const mintNft = () => {
        console.log("Started");
        if (!title || !desc || !image || targetEmbedding.length == 0) {
            console.log("Data Not sufficient");
            return;
        }
        console.log("Started 2");
        const reader = new window.FileReader();
        reader.readAsArrayBuffer(image);
        reader.onloadend = async () => {
            console.log("Started 3");
            const res = await ipfs.add(Buffer(reader.result));
            console.log({ res });

            // minting
            let uriMetadata = `{"name":"${title}","description":"${desc}","image":"https://ipfs.io/ipfs/${res.path}/","encodings":"[${targetEmbedding}]"}`;
            const buff = Buffer.from(uriMetadata);
            const result = await ipfs.add(buff);
            console.log({ result });
            console.log(`ipfs://${result.path}/`);
            contract.methods
                .mintNFT(accounts[0], `ipfs://${result.path}/`)
                .send({ from: accounts[0] })
                .then((_res) => {
                    alert("Success In Minting!");
                });
        };
    };
    return (
        <>
            <div className="flex flex-wrap">
                <div className="w-full lg:w-8/12 px-4">
                    <CardSettings
                        title={title}
                        setTitle={setTitle}
                        desc={desc}
                        setDesc={setDesc}
                        image={image}
                        setImage={setImage}
                        mintNft={mintNft}
                        allowed={allowed}
                        setAllowed={setAllowed}
                    />
                </div>
                <div className="w-full lg:w-4/12 px-4 mt-16">
                    <CardProfile address={accounts[0]} />
                </div>
            </div>
            {targetEmbedding.length > 0 && (
                <NFTS
                    targetEmbeddings={targetEmbedding}
                    imageFile={image}
                    allowed={allowed}
                    setAllowed={setAllowed}
                />
            )}
            {showModal && (
                <Modal setIsOpen={setShowModal} data={modelContent} />
            )}
        </>
    );
}

// Settings.layout = Admin;
