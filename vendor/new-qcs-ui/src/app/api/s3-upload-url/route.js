import AWS from 'aws-sdk';

const s3 = new AWS.S3({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        
        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const fileName = `${Date.now()}${file.name}`;
        const key = `avatars/${fileName}`;

        // Upload directly to S3 from server
        const uploadParams = {
            Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: file.type,
            // ACL: 'public-read', // Optional
        };

        await s3.upload(uploadParams).promise();

        const fileUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${key}`;

        return Response.json({
            success: true,
            url: fileUrl,
            key: key
        });

    } catch (error) {
        console.error('Upload error:', error);
        return Response.json({ error: 'Upload failed' }, { status: 500 });
    }
}