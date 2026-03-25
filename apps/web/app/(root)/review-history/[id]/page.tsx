import { ReviewContent } from './_components/review-content';

type Props = {
    params: Promise<{
        id: string;
    }>;
};

const ReviewDetailPage = async ({ params }: Props) => {
    const { id } = await params;
    return (
        <div>
            <ReviewContent id={id} />
        </div>
    );
};

export default ReviewDetailPage;
