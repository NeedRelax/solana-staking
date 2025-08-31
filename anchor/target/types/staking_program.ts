/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/staking_program.json`.
 */
export type StakingProgram = {
  "address": "GjQvMVAgqV8UJmBdMxv2o6B3kNj7fZvw6LBctkQdFK7r",
  "metadata": {
    "name": "stakingProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "changeAdmin",
      "discriminator": [
        193,
        151,
        203,
        161,
        200,
        202,
        32,
        146
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "claimRewards",
      "discriminator": [
        4,
        144,
        132,
        71,
        116,
        23,
        151,
        80
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "userStakeInfo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  105,
                  110,
                  102,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userRewardWallet",
          "writable": true
        },
        {
          "name": "rewardVault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "rewardMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "closeUserStakeInfo",
      "discriminator": [
        158,
        181,
        54,
        43,
        106,
        197,
        50,
        109
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userStakeInfo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  105,
                  110,
                  102,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "emergencyWithdrawRewardTokens",
      "discriminator": [
        155,
        218,
        30,
        78,
        244,
        156,
        83,
        117
      ],
      "accounts": [
        {
          "name": "pool"
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "rewardMint",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "rewardVault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "destinationWallet",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "emergencyWithdrawStakedTokens",
      "discriminator": [
        250,
        227,
        48,
        38,
        183,
        181,
        26,
        89
      ],
      "accounts": [
        {
          "name": "pool"
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "stakingVault",
          "writable": true
        },
        {
          "name": "stakingMint"
        },
        {
          "name": "destinationWallet",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundRewards",
      "discriminator": [
        114,
        64,
        163,
        112,
        175,
        167,
        19,
        121
      ],
      "accounts": [
        {
          "name": "pool"
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "funderWallet",
          "writable": true
        },
        {
          "name": "rewardVault",
          "writable": true
        },
        {
          "name": "rewardMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "stakingMint"
        },
        {
          "name": "stakingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "rewardMint"
        },
        {
          "name": "rewardVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "rewardRate",
          "type": "u64"
        },
        {
          "name": "lockupDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "pause",
      "discriminator": [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "stake",
      "discriminator": [
        206,
        176,
        202,
        18,
        200,
        209,
        179,
        108
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "userStakeInfo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  105,
                  110,
                  102,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userStakingWallet",
          "writable": true
        },
        {
          "name": "stakingVault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "stakingMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unpause",
      "discriminator": [
        169,
        144,
        4,
        38,
        10,
        141,
        188,
        255
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "unstake",
      "discriminator": [
        90,
        95,
        107,
        42,
        205,
        124,
        50,
        225
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "userStakeInfo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  105,
                  110,
                  102,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userStakingWallet",
          "writable": true
        },
        {
          "name": "stakingVault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "stakingMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateLockupDuration",
      "discriminator": [
        61,
        91,
        174,
        32,
        209,
        193,
        36,
        149
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        }
      ],
      "args": [
        {
          "name": "newDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "updateRewardRate",
      "discriminator": [
        105,
        157,
        0,
        185,
        21,
        144,
        163,
        159
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "pool"
          ]
        }
      ],
      "args": [
        {
          "name": "newRate",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "userStakeInfo",
      "discriminator": [
        219,
        233,
        236,
        123,
        28,
        113,
        89,
        56
      ]
    }
  ],
  "events": [
    {
      "name": "changeAdminEvent",
      "discriminator": [
        95,
        136,
        84,
        236,
        108,
        109,
        169,
        182
      ]
    },
    {
      "name": "claimEvent",
      "discriminator": [
        93,
        15,
        70,
        170,
        48,
        140,
        212,
        219
      ]
    },
    {
      "name": "fundRewardsEvent",
      "discriminator": [
        201,
        122,
        109,
        250,
        235,
        114,
        171,
        27
      ]
    },
    {
      "name": "pauseEvent",
      "discriminator": [
        32,
        51,
        61,
        169,
        156,
        104,
        130,
        43
      ]
    },
    {
      "name": "stakeEvent",
      "discriminator": [
        226,
        134,
        188,
        173,
        19,
        33,
        75,
        175
      ]
    },
    {
      "name": "unpauseEvent",
      "discriminator": [
        134,
        156,
        8,
        215,
        185,
        128,
        192,
        217
      ]
    },
    {
      "name": "unstakeEvent",
      "discriminator": [
        162,
        104,
        137,
        228,
        81,
        3,
        79,
        197
      ]
    },
    {
      "name": "updateLockupDurationEvent",
      "discriminator": [
        27,
        195,
        229,
        136,
        143,
        246,
        53,
        50
      ]
    },
    {
      "name": "updateRewardRateEvent",
      "discriminator": [
        205,
        45,
        190,
        210,
        23,
        74,
        0,
        53
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroStakeAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6001,
      "name": "zeroUnstakeAmount",
      "msg": "Unstake amount must be greater than zero."
    },
    {
      "code": 6002,
      "name": "zeroFundAmount",
      "msg": "Funding amount must be greater than zero."
    },
    {
      "code": 6003,
      "name": "insufficientStakeAmount",
      "msg": "Insufficient staked amount."
    },
    {
      "code": 6004,
      "name": "lockupPeriodNotEnded",
      "msg": "Lockup period has not ended yet."
    },
    {
      "code": 6005,
      "name": "noRewardsToClaim",
      "msg": "No rewards to claim."
    },
    {
      "code": 6006,
      "name": "stakeNotZero",
      "msg": "Stake amount must be zero to close account."
    },
    {
      "code": 6007,
      "name": "rewardsNotClaimed",
      "msg": "All rewards must be claimed to close account."
    },
    {
      "code": 6008,
      "name": "notAdmin",
      "msg": "Only the admin can perform this action."
    },
    {
      "code": 6009,
      "name": "arithmeticOverflow",
      "msg": "An arithmetic operation overflowed."
    },
    {
      "code": 6010,
      "name": "programPaused",
      "msg": "Program is paused."
    },
    {
      "code": 6011,
      "name": "alreadyPaused",
      "msg": "Program is already paused."
    },
    {
      "code": 6012,
      "name": "notPaused",
      "msg": "Program is not paused."
    },
    {
      "code": 6013,
      "name": "insufficientVaultBalance",
      "msg": "Insufficient balance in reward vault."
    }
  ],
  "types": [
    {
      "name": "changeAdminEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "newAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "claimEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundRewardsEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pauseEvent",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "stakingMint",
            "type": "pubkey"
          },
          {
            "name": "stakingVault",
            "type": "pubkey"
          },
          {
            "name": "rewardMint",
            "type": "pubkey"
          },
          {
            "name": "rewardVault",
            "type": "pubkey"
          },
          {
            "name": "rewardRate",
            "type": "u64"
          },
          {
            "name": "lastUpdateTimestamp",
            "type": "i64"
          },
          {
            "name": "totalStaked",
            "type": "u64"
          },
          {
            "name": "rewardPerTokenStored",
            "type": "u128"
          },
          {
            "name": "poolBump",
            "type": "u8"
          },
          {
            "name": "lockupDuration",
            "type": "i64"
          },
          {
            "name": "isPaused",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "stakeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "unpauseEvent",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "unstakeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "updateLockupDurationEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "newDuration",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "updateRewardRateEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "newRate",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userStakeInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakeAmount",
            "type": "u64"
          },
          {
            "name": "stakeStartTimestamp",
            "type": "i64"
          },
          {
            "name": "rewardPerTokenPaid",
            "type": "u128"
          },
          {
            "name": "rewards",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
