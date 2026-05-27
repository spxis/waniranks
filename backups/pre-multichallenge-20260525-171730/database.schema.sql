--
-- PostgreSQL database dump
--

\restrict 7kCGaZ6h6zT5eS2JVInhW3WPG0Vg4ez2COhF4ZboKONOzvLZgGLr7qjLpJ3rPO1

-- Dumped from database version 17.10 (322a063)
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: StudyReviewResult; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."StudyReviewResult" AS ENUM (
    'correct',
    'wrong',
    'skipped'
);


ALTER TYPE public."StudyReviewResult" OWNER TO neondb_owner;

--
-- Name: SubjectReviewSnapshotSource; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."SubjectReviewSnapshotSource" AS ENUM (
    'sync',
    'ondemand',
    'submit'
);


ALTER TYPE public."SubjectReviewSnapshotSource" OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    nickname text NOT NULL,
    "tokenEncrypted" text NOT NULL,
    "tokenIv" text NOT NULL,
    "tokenTag" text NOT NULL,
    "wkUserId" text NOT NULL,
    "wkUsername" text NOT NULL,
    "wkLevel" integer NOT NULL,
    "reviewCount" integer DEFAULT 0 NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    "lastSyncedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "burnedCount" integer DEFAULT 0 NOT NULL,
    "pendingReviews" integer DEFAULT 0 NOT NULL,
    "apprenticeCount" integer DEFAULT 0 NOT NULL,
    "enlightenedCount" integer DEFAULT 0 NOT NULL,
    "estimatedHoursRemaining" integer,
    "guruCount" integer DEFAULT 0 NOT NULL,
    "isSyncing" boolean DEFAULT false NOT NULL,
    "lastSyncError" text,
    "lastSyncStatus" text DEFAULT 'idle'::text NOT NULL,
    "levelKanjiGuruPlus" integer DEFAULT 0 NOT NULL,
    "levelKanjiItems" jsonb,
    "levelKanjiLearned" integer DEFAULT 0 NOT NULL,
    "levelKanjiLocked" integer DEFAULT 0 NOT NULL,
    "levelKanjiTotal" integer DEFAULT 0 NOT NULL,
    "masterCount" integer DEFAULT 0 NOT NULL,
    "nextSyncAllowedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "syncLockUntil" timestamp(3) without time zone,
    "radicalCount" integer DEFAULT 0 NOT NULL,
    "vocabularyCount" integer DEFAULT 0 NOT NULL,
    "lastActivityAt" timestamp(3) without time zone,
    "itemSpread" jsonb,
    "jlptCounts" jsonb,
    "assignmentCache" jsonb,
    "assignmentCacheUpdatedAt" timestamp(3) without time zone,
    "lastKanjiGuruedAt" timestamp(3) without time zone,
    "lastRadicalGuruedAt" timestamp(3) without time zone,
    "lastVocabularyGuruedAt" timestamp(3) without time zone,
    "reviewsUpdatedAt" timestamp(3) without time zone,
    "wkHttpCache" jsonb,
    "lastKanjiGuruedItem" jsonb,
    "lastRadicalGuruedItem" jsonb,
    "lastVocabularyGuruedItem" jsonb,
    "joinedByEmail" text,
    "joinedByName" text,
    "inviteCodeHash" text,
    "inviteCodeUpdatedAt" timestamp(3) without time zone
);


ALTER TABLE public."Account" OWNER TO neondb_owner;

--
-- Name: DailyAccountSnapshot; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DailyAccountSnapshot" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "snapshotDatePst" text NOT NULL,
    "snapshotAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "wkLevel" integer NOT NULL,
    "reviewCount" integer NOT NULL,
    "burnedCount" integer NOT NULL,
    "pendingReviews" integer NOT NULL,
    "radicalCount" integer NOT NULL,
    "vocabularyCount" integer NOT NULL,
    "apprenticeCount" integer NOT NULL,
    "guruCount" integer NOT NULL,
    "masterCount" integer NOT NULL,
    "enlightenedCount" integer NOT NULL,
    "levelKanjiLearned" integer NOT NULL,
    "levelKanjiTotal" integer NOT NULL,
    score integer NOT NULL,
    "lastActivityAt" timestamp(3) without time zone,
    "lastSyncedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DailyAccountSnapshot" OWNER TO neondb_owner;

--
-- Name: JlptKanji; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."JlptKanji" (
    id text NOT NULL,
    kanji text NOT NULL,
    "nLevel" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "enrichedAt" timestamp(3) without time zone,
    "kunReadings" text[] DEFAULT ARRAY[]::text[],
    meanings text[] DEFAULT ARRAY[]::text[],
    "nanoriReadings" text[] DEFAULT ARRAY[]::text[],
    "onReadings" text[] DEFAULT ARRAY[]::text[],
    "primaryMeaning" text,
    "strokeCount" integer,
    "frequencyRank" integer,
    "heisigKeyword" text,
    notes text[] DEFAULT ARRAY[]::text[],
    "schoolGrade" integer,
    "sourceJlpt" integer,
    "unicodeHex" text,
    "wordExamples" jsonb
);


ALTER TABLE public."JlptKanji" OWNER TO neondb_owner;

--
-- Name: LevelSnapshot; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LevelSnapshot" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    level integer NOT NULL,
    "kanjiTotal" integer DEFAULT 0 NOT NULL,
    "kanjiLearned" integer DEFAULT 0 NOT NULL,
    "kanjiGuruPlus" integer DEFAULT 0 NOT NULL,
    "kanjiLocked" integer DEFAULT 0 NOT NULL,
    "estimatedHoursRemaining" integer,
    items jsonb,
    "syncedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LevelSnapshot" OWNER TO neondb_owner;

--
-- Name: ReadingChallengeBook; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ReadingChallengeBook" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    isbn text NOT NULL,
    title text NOT NULL,
    "thumbnailUrl" text,
    "infoUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ReadingChallengeBook" OWNER TO neondb_owner;

--
-- Name: ReadingChallengeMember; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ReadingChallengeMember" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    tracked boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ReadingChallengeMember" OWNER TO neondb_owner;

--
-- Name: ReadingSignoff; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ReadingSignoff" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "signoffDatePst" text NOT NULL,
    "bookTitle" text NOT NULL,
    "pagesRead" integer NOT NULL,
    "minutesRead" integer NOT NULL,
    "didWanikaniReviews" boolean DEFAULT false NOT NULL,
    "reviewsLeft" integer NOT NULL,
    "apprenticeCount" integer NOT NULL,
    "currentWkLevel" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ReadingSignoff" OWNER TO neondb_owner;

--
-- Name: ReadingSignoffEntry; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ReadingSignoffEntry" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "signoffDatePst" text NOT NULL,
    "bookTitle" text NOT NULL,
    "pagesRead" integer NOT NULL,
    "minutesRead" integer NOT NULL,
    "didWanikaniReviews" boolean DEFAULT false NOT NULL,
    "reviewWorkDone" integer DEFAULT 0 NOT NULL,
    "reviewCorrect" integer DEFAULT 0 NOT NULL,
    "reviewIncorrect" integer DEFAULT 0 NOT NULL,
    "reviewSuccessPercent" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ReadingSignoffEntry" OWNER TO neondb_owner;

--
-- Name: StudyReviewAttempt; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."StudyReviewAttempt" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "assignmentId" integer NOT NULL,
    "subjectId" integer NOT NULL,
    "subjectType" text NOT NULL,
    result public."StudyReviewResult" NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StudyReviewAttempt" OWNER TO neondb_owner;

--
-- Name: SubjectReviewStatsSnapshot; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."SubjectReviewStatsSnapshot" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "subjectId" integer NOT NULL,
    "subjectType" text NOT NULL,
    "meaningCorrect" integer NOT NULL,
    "meaningIncorrect" integer NOT NULL,
    "meaningCurrentStreak" integer NOT NULL,
    "meaningMaxStreak" integer NOT NULL,
    "readingCorrect" integer NOT NULL,
    "readingIncorrect" integer NOT NULL,
    "readingCurrentStreak" integer NOT NULL,
    "readingMaxStreak" integer NOT NULL,
    "percentageCorrect" integer NOT NULL,
    "capturedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source public."SubjectReviewSnapshotSource" DEFAULT 'ondemand'::public."SubjectReviewSnapshotSource" NOT NULL
);


ALTER TABLE public."SubjectReviewStatsSnapshot" OWNER TO neondb_owner;

--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: DailyAccountSnapshot DailyAccountSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."DailyAccountSnapshot"
    ADD CONSTRAINT "DailyAccountSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: JlptKanji JlptKanji_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JlptKanji"
    ADD CONSTRAINT "JlptKanji_pkey" PRIMARY KEY (id);


--
-- Name: LevelSnapshot LevelSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LevelSnapshot"
    ADD CONSTRAINT "LevelSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: ReadingChallengeBook ReadingChallengeBook_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ReadingChallengeBook"
    ADD CONSTRAINT "ReadingChallengeBook_pkey" PRIMARY KEY (id);


--
-- Name: ReadingChallengeMember ReadingChallengeMember_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ReadingChallengeMember"
    ADD CONSTRAINT "ReadingChallengeMember_pkey" PRIMARY KEY (id);


--
-- Name: ReadingSignoffEntry ReadingSignoffEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ReadingSignoffEntry"
    ADD CONSTRAINT "ReadingSignoffEntry_pkey" PRIMARY KEY (id);


--
-- Name: ReadingSignoff ReadingSignoff_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ReadingSignoff"
    ADD CONSTRAINT "ReadingSignoff_pkey" PRIMARY KEY (id);


--
-- Name: StudyReviewAttempt StudyReviewAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."StudyReviewAttempt"
    ADD CONSTRAINT "StudyReviewAttempt_pkey" PRIMARY KEY (id);


--
-- Name: SubjectReviewStatsSnapshot SubjectReviewStatsSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SubjectReviewStatsSnapshot"
    ADD CONSTRAINT "SubjectReviewStatsSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: Account_wkUserId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Account_wkUserId_key" ON public."Account" USING btree ("wkUserId");


--
-- Name: DailyAccountSnapshot_accountId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "DailyAccountSnapshot_accountId_idx" ON public."DailyAccountSnapshot" USING btree ("accountId");


--
-- Name: DailyAccountSnapshot_accountId_snapshotDatePst_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "DailyAccountSnapshot_accountId_snapshotDatePst_key" ON public."DailyAccountSnapshot" USING btree ("accountId", "snapshotDatePst");


--
-- Name: JlptKanji_kanji_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "JlptKanji_kanji_key" ON public."JlptKanji" USING btree (kanji);


--
-- Name: JlptKanji_nLevel_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "JlptKanji_nLevel_idx" ON public."JlptKanji" USING btree ("nLevel");


--
-- Name: LevelSnapshot_accountId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "LevelSnapshot_accountId_idx" ON public."LevelSnapshot" USING btree ("accountId");


--
-- Name: LevelSnapshot_accountId_level_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "LevelSnapshot_accountId_level_key" ON public."LevelSnapshot" USING btree ("accountId", level);


--
-- Name: ReadingChallengeBook_accountId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingChallengeBook_accountId_idx" ON public."ReadingChallengeBook" USING btree ("accountId");


--
-- Name: ReadingChallengeBook_accountId_isbn_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "ReadingChallengeBook_accountId_isbn_key" ON public."ReadingChallengeBook" USING btree ("accountId", isbn);


--
-- Name: ReadingChallengeMember_accountId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingChallengeMember_accountId_idx" ON public."ReadingChallengeMember" USING btree ("accountId");


--
-- Name: ReadingChallengeMember_accountId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "ReadingChallengeMember_accountId_key" ON public."ReadingChallengeMember" USING btree ("accountId");


--
-- Name: ReadingSignoffEntry_accountId_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingSignoffEntry_accountId_createdAt_idx" ON public."ReadingSignoffEntry" USING btree ("accountId", "createdAt");


--
-- Name: ReadingSignoffEntry_accountId_signoffDatePst_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingSignoffEntry_accountId_signoffDatePst_idx" ON public."ReadingSignoffEntry" USING btree ("accountId", "signoffDatePst");


--
-- Name: ReadingSignoffEntry_signoffDatePst_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingSignoffEntry_signoffDatePst_idx" ON public."ReadingSignoffEntry" USING btree ("signoffDatePst");


--
-- Name: ReadingSignoff_accountId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingSignoff_accountId_idx" ON public."ReadingSignoff" USING btree ("accountId");


--
-- Name: ReadingSignoff_accountId_signoffDatePst_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "ReadingSignoff_accountId_signoffDatePst_key" ON public."ReadingSignoff" USING btree ("accountId", "signoffDatePst");


--
-- Name: ReadingSignoff_signoffDatePst_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ReadingSignoff_signoffDatePst_idx" ON public."ReadingSignoff" USING btree ("signoffDatePst");


--
-- Name: StudyReviewAttempt_accountId_subjectId_submittedAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "StudyReviewAttempt_accountId_subjectId_submittedAt_idx" ON public."StudyReviewAttempt" USING btree ("accountId", "subjectId", "submittedAt");


--
-- Name: StudyReviewAttempt_accountId_submittedAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "StudyReviewAttempt_accountId_submittedAt_idx" ON public."StudyReviewAttempt" USING btree ("accountId", "submittedAt");


--
-- Name: SubjectReviewStatsSnapshot_accountId_capturedAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "SubjectReviewStatsSnapshot_accountId_capturedAt_idx" ON public."SubjectReviewStatsSnapshot" USING btree ("accountId", "capturedAt");


--
-- Name: SubjectReviewStatsSnapshot_accountId_subjectId_capturedAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "SubjectReviewStatsSnapshot_accountId_subjectId_capturedAt_idx" ON public."SubjectReviewStatsSnapshot" USING btree ("accountId", "subjectId", "capturedAt");


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict 7kCGaZ6h6zT5eS2JVInhW3WPG0Vg4ez2COhF4ZboKONOzvLZgGLr7qjLpJ3rPO1

