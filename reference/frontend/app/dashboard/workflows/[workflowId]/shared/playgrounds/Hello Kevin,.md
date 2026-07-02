Hello Kevin,

Thank you for sending the logs.

We analyzed these logs against the Retab server-side logs. Among these runs, we found:

- 95 log rows total
- 24 synthetic test alerts, which we ignored
- 71 real production rows

Out of the 71 real production rows:

- 65 completed server-side
- 3 failed server-side
- 3 had no matching Retab workflow run

The 65 rows that completed server-side could have avoided appearing as failures if your timeout threshold had been higher.

For the remaining cases:

| Row | Status | Notes |
| --- | ---: | --- | --- |
| 2 | `failed_image_too_large` | This was caused by a retry-policy bug that has since been corrected. This file can now be processed successfully. |
| 15 | `failed_workflow_error` | Same issue as row 2: retry-policy bug, now corrected. |
| 37 | No Retab workflow run found | The request was not received by Retab. |
| 87 | Fetch failed before workflow | The request was not received by Retab. |
| 88 | Fetch failed before workflow | The request was not received by Retab. |
| 94 | Invalid image | The image sent was invalid. See attachment. |

I think this is also a good opportunity to explain the constraints we are operating under and the technical choices our platform is built on.

Regardless of the provider, LLM infrastructure is globally under severe shortage, and this makes the infrastructure flaky. Many LLM providers have partial one-minute outages several times per day.

For long documents in particular, LLM infrastructure is extremely flaky. We observe much higher success rates for simple text prompts than for large image-heavy requests, which makes sense.

Our whole workflow system runs on Temporal as a workflow orchestrator. The role of Temporal is simple: define an error-code-based policy, and retry until the workflow succeeds according to that policy.

We built our infrastructure on Google Cloud, which arguably has the best AI infrastructure available: TPUs, a culture of operating compute at astronomical scale, and access to some of the best long-context vision models on the market.

Each time we receive a `429` rate-limit error, which can happen quite randomly and does not necessarily correspond to our provisioned rate limits, or a `503` service-unavailable error, we keep retrying under a backoff policy: 1 minute, 2 minutes, 3 minutes, 4 minutes, then 5 minutes as a cap, for up to one day, until the workflow completes.

The philosophy behind this has tradeoffs. We are not the right platform for real-time inference. We are the best platform for companies operating real-life workflows, where requests need to eventually go through no matter what, with the highest quality and reliability possible, at the expense of speed.

Most importantly for you: if we did not have Temporal, 2,135 out of 6,272 requests from yesterday would have errored. Yes, that number is real.

So we went from 66% to 99.92% reliability yesterday thanks to this infrastructure.

Every company that is serious about AI inference has some version of this. In our case, that is our workflow system, but also the `background=true` mode in our APIs.

And many other things are happening under the hood besides that: all images are rotated upright before being processed with custom-built image models, and we have additional internal techniques to make some operations scale to longer documents. But that is probably a separate discussion.

Best,  
Sacha