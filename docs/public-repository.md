# public リポジトリとしての公開範囲

- **決定**: 2026-11-07、所有者（Yuki-Watanabe7）が、このリポジトリを public のままにすると決めた。
- **関連**: [#23](https://github.com/Yuki-Watanabe7/econboard-studio/issues/23)（この記録）
- **方針**: [Artifact Publication Policy v1](https://github.com/Yuki-Watanabe7/portfolio-control-plane/blob/main/docs/governance/artifact-publication-policy.md) の §4 が求める判断記録。項目は方針に合わせている。

## 公開しているもの

公開しているのは、リポジトリそのものだけである。誰でも読める。

- **ソースと全ブランチの履歴**: 自作のコードと、架空都市「エコノポリス」のサンプルデータ。
- **Issue / PR とコメント**
- **Actions のログ**: 90 日で失効する。

artifact・Release・GitHub Pages・パッケージは出していない（2026-11-07 に API で確認）。画像・フォント・音声のファイルもない。画面は SVG で描いている。

## public にする理由

- 秘密情報を含まない。
- public repo では、GitHub-hosted runner の Actions が無料になるなど、GitHub を有利に使える。

## 素材の出典とライセンス

第三者のデータ・素材は使っていない。既存作品の名称・画像・音声は使わない方針である（[README の「IP / アセットに関する注意」](../README.md#ip--アセットに関する注意)）。

LICENSE ファイルはない。閲覧はできるが、利用の許諾は与えていない状態である。

## 秘密情報と個人データの確認（2026-11-07）

| 対象                                                 | 結果                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全ブランチの履歴（22 commit、過去に存在したパス 73） | API キー、トークン、秘密鍵、AWS の識別子、パスワードの代入らしい文字列はない。メールアドレスと IP アドレスもない。`.env`、DB、CSV、PDF、画像は一度も commit されていない。                                                    |
| commit のメールアドレス                              | 所有者のもの1つだけ。DME など、他の public repo で既に公開されている。                                                                                                                                                        |
| Issue / PR 22 件、コメント 6 件                      | 書いたのは所有者と `claude[bot]` だけ。メールアドレス、IP アドレス、秘密情報らしい文字列はない。                                                                                                                              |
| Actions                                              | artifact 0 件、Release 0 件。secrets は `CLAUDE_CODE_OAUTH_TOKEN` だけで、値はログ上で伏せられる。                                                                                                                            |
| Claude の全出力                                      | `claude.yml` は `show_full_output: true` だった。そのため 2026-07-09 の 3 回の実行では、ツールの実行結果を含む全出力がログに出ていた。これらのログは失効済みである（API が 410 Gone を返す）。#23 で既定の `false` に戻した。 |

## 外部の人が起動できる workflow

| workflow                               | 起動条件と制限                                                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                               | `main` への push と PR。権限は `contents: read` で、secrets を使わない。fork からの PR には secrets が渡らない。                                                                                                                                    |
| `claude.yml`、`claude-code-review.yml` | `@claude` を含む Issue、コメント、PR、レビューで起動し、`CLAUDE_CODE_OAUTH_TOKEN` を使う。#23 で、`author_association` が OWNER / MEMBER / COLLABORATOR のときだけ動くようにした。claude-code-action 自体も、書き込み権限のない人の依頼を拒否する。 |

調査で Claude の全出力が必要になったときは、`show_full_output` を一時的に `true` にする。調べ終えたら戻す。その間のログは誰でも読める。

## 止め方と、取り消せないこと

private に戻すには次を実行する（Settings → General → Danger Zone からでもよい）。

```bash
gh repo edit Yuki-Watanabe7/econboard-studio --visibility private --accept-visibility-change-consequences
```

ただし、次のものは回収できない。

- 公開中に取得された clone とログ。
- fork。private に戻しても、既存の public fork は残る。2026-11-07 時点で fork は 0。

private に戻すと、Actions は private repo の無料枠と課金の対象になる。

## 見直し

2027-11-07 までに見直す。次のどれかが起きたときも見直す。

- 第三者の素材を入れるとき。画像、フォント、音声、実在のデータ、既存作品のデータなど。
- 秘密情報を必要とする機能や workflow を足すとき。
- artifact、Release、GitHub Pages、パッケージの公開を始めるとき。
- LICENSE を選ぶとき、collaborator を加えるとき、GitHub のプランが変わるとき。
