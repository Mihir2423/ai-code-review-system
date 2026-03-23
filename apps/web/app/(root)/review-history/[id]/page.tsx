import { ReviewContent } from "./_components/review-content"

type Props = {
  params: Promise<{
    id: string
  }>
}

const sessionData = [
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "REVIEW_STARTED",
    queueName: "pr-review",
    stage: "PR Review",
    status: "success",
    message: "Started reviewing PR #72",
    owner: "Mihir2423",
    repo: "piggame",
    timestamp: "2026-03-23T00:44:53.182Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "PR_DETAILS_FETCHED",
    queueName: "pr-review",
    stage: "Fetch PR Details",
    status: "success",
    timestamp: "2026-03-23T00:44:54.200Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "CHECK_RUN_CREATED",
    queueName: "pr-review",
    stage: "Create Check Run",
    status: "success",
    timestamp: "2026-03-23T00:44:55.100Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "CONTEXT_RETRIEVAL_STARTED",
    queueName: "pr-review",
    stage: "Queue Context Retrieval",
    status: "success",
    timestamp: "2026-03-23T00:44:55.800Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "COMMENT_POSTED",
    queueName: "pr-review",
    stage: "Post Initial Comment",
    status: "success",
    timestamp: "2026-03-23T00:44:56.500Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "CONTEXT_RETRIEVAL_STARTED",
    queueName: "pr-context",
    stage: "Context Retrieval",
    status: "pending",
    timestamp: "2026-03-23T00:44:57.000Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "CONTEXT_RETRIEVED",
    queueName: "pr-context",
    stage: "Context Retrieval",
    status: "success",
    timestamp: "2026-03-23T00:44:59.200Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "AI_REVIEW_STARTED",
    queueName: "pr-ai-review",
    stage: "AI Review",
    status: "pending",
    timestamp: "2026-03-23T00:45:00.100Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "AI_REVIEW_COMPLETED",
    queueName: "pr-ai-review",
    stage: "AI Review",
    status: "success",
    timestamp: "2026-03-23T00:45:05.400Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "ISSUES_POSTED",
    queueName: "pr-ai-review",
    stage: "Post Issues",
    status: "success",
    timestamp: "2026-03-23T00:45:06.200Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "CHECK_RUN_UPDATED",
    queueName: "pr-ai-review",
    stage: "Update Check Run",
    status: "success",
    timestamp: "2026-03-23T00:45:07.100Z"
  },
  {
    reviewId: "cmn2grhzw0000c3rntd5yk63d",
    type: "REVIEW_COMPLETED",
    queueName: "pr-ai-review",
    stage: "Review Complete",
    status: "success",
    timestamp: "2026-03-23T00:45:08.500Z"
  }
];

const ReviewDetailPage = async ({ params }: Props) => {
  const {id} = await params
  return (
    <div>
      <ReviewContent id={id} />
    </div>
  )
}

export default ReviewDetailPage
