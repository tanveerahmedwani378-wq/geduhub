/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to GEDUHub AI — confirm your email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://mxfruxtrsqdehvatuihj.supabase.co/storage/v1/object/public/email-assets/geduhub-logo.png"
          width="56"
          height="56"
          alt="GEDUHub"
          style={{ borderRadius: '14px', marginBottom: '24px' }}
        />
        <Heading style={h1}>Welcome to GEDUHub AI! 🎓</Heading>
        <Text style={text}>
          Thanks for signing up! You're one step away from your AI-powered learning assistant.
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to get started:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify & Get Started
        </Button>
        <Text style={footer}>
          If you didn't create a GEDUHub account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(222, 47%, 11%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(220, 9%, 46%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: 'hsl(174, 72%, 40%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(174, 72%, 40%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
