#!/bin/bash

# ================================================
# TEST MATCHING ALGORITHM
# ================================================

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing Match Participants Function${NC}"
echo ""

# Check if month ID is provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: Month ID required${NC}"
  echo ""
  echo "Usage: ./test_matching.sh <month-id>"
  echo ""
  echo "Example: ./test_matching.sh 12345678-1234-1234-1234-123456789abc"
  echo ""
  echo "To get your month ID, run this query in Supabase SQL Editor:"
  echo "  SELECT id, month_date, dinner_date FROM mesa_abierta_months WHERE status = 'open';"
  echo ""
  exit 1
fi

MONTH_ID=$1

# Get Supabase URL and anon key from environment
SUPABASE_URL="https://mulsqxfhxxdsadxsljss.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"  # Replace with actual key

echo -e "${YELLOW}📋 Test Details:${NC}"
echo "  Month ID: $MONTH_ID"
echo "  Function: match-participants"
echo ""

echo -e "${YELLOW}🚀 Invoking function...${NC}"
echo ""

# Call the function
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/match-participants" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"monthId\":\"${MONTH_ID}\"}")

# Check if response contains "success"
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Matching completed successfully!${NC}"
  echo ""
  echo "Response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo -e "${RED}❌ Matching failed${NC}"
  echo ""
  echo "Response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo -e "${YELLOW}📊 Next steps:${NC}"
echo "1. Check the database for created matches:"
echo "   SELECT * FROM mesa_abierta_matches WHERE month_id = '${MONTH_ID}';"
echo ""
echo "2. Check assignments:"
echo "   SELECT * FROM mesa_abierta_assignments a"
echo "   JOIN mesa_abierta_matches m ON m.id = a.match_id"
echo "   WHERE m.month_id = '${MONTH_ID}';"
echo ""
echo "3. Check participant statuses:"
echo "   SELECT id, role_preference, assigned_role, status"
echo "   FROM mesa_abierta_participants"
echo "   WHERE month_id = '${MONTH_ID}';"
