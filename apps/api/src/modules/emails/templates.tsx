import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
} from '@react-email/components';
import { render } from '@react-email/render';
import { env } from '../../config';
export async function emailTemplate(name: string, title: string, message: string) {
  return render(
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ background: '#f4f5f7', fontFamily: 'Arial, sans-serif' }}>
        <Container
          style={{ margin: '40px auto', padding: '32px', background: '#ffffff', borderRadius: 16 }}
        >
          <Heading style={{ color: '#5245dd' }}>trackr.</Heading>
          <Heading as="h2">{title}</Heading>
          <Text>Hi {name},</Text>
          <Text>{message}</Text>
          <Button
            href={`${env.WEB_URL}/app`}
            style={{ background: '#5245dd', color: '#fff', padding: '12px 20px', borderRadius: 8 }}
          >
            Open your workspace
          </Button>
          <Hr />
          <Text style={{ color: '#7a7a86', fontSize: 12 }}>
            A little momentum goes a long way. — Trackr
          </Text>
        </Container>
      </Body>
    </Html>,
  );
}
