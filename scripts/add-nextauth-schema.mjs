import fs from 'fs';

const authModels = `

// ==========================================
// NextAuth / Auth.js Models
// ==========================================

model User {
  id            String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name          String?
  email         String?   @unique
  emailVerified DateTime? @map("email_verified")
  image         String?
  password      String?
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  accounts      Account[]
  sessions      Session[]

  @@map("users")
}

model Account {
  id                 String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId             String  @map("user_id") @db.Uuid
  type               String
  provider           String
  providerAccountId  String  @map("provider_account_id")
  refresh_token      String? @db.Text
  access_token       String? @db.Text
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String? @db.Text
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id") @db.Uuid
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
`;

fs.appendFileSync('prisma/schema.prisma', authModels);
console.log('NextAuth models appended');
