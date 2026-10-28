// Starter templates for new projects across supported languages

const TEMPLATES = {
  javascript: [
    {
      name: "index.js",
      path: "/",
      language: "javascript",
      is_entry_point: true,
      content: `// CodeForge JavaScript Starter
function solution(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) {
      return [map.get(diff), i];
    }
    map.set(nums[i], i);
  }
  return [];
}

const numbers = [2, 7, 11, 15];
const target = 9;
const result = solution(numbers, target);
console.log("Indices:", result);
console.log("Numbers:", result.map(i => numbers[i]));
`,
    },
    {
      name: "helpers.js",
      path: "/",
      language: "javascript",
      is_entry_point: false,
      content: `// Modular helper functions
export function formatCurrency(amount) {
  return "$" + amount.toFixed(2);
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}
`,
    },
    {
      name: "README.md",
      path: "/",
      language: "markdown",
      is_entry_point: false,
      content: `# Collaborative JavaScript Workspace
This project is shared in real-time using Yjs CRDTs on CodeForge.
- Run code in an isolated execution sandbox.
- Invite team members to collaborate simultaneously.
- Track version checkpoints.
`,
    },
  ],

  python: [
    {
      name: "main.py",
      path: "/",
      language: "python",
      is_entry_point: true,
      content: `# CodeForge Python Starter
import sys

def two_sum(nums, target):
    seen = {}
    for idx, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], idx]
        seen[num] = idx
    return []

if __name__ == "__main__":
    nums = [3, 2, 4]
    target = 6
    ans = two_sum(nums, target)
    print("Indices:", ans)
    print("Values:", [nums[i] for i in ans])
`,
    },
    {
      name: "utils.py",
      path: "/",
      language: "python",
      is_entry_point: false,
      content: `# Utility functions
def is_palindrome(s: str) -> bool:
    clean = "".join(c.lower() for c in s if c.isalnum())
    return clean == clean[::-1]
`,
    },
  ],

  cpp: [
    {
      name: "main.cpp",
      path: "/",
      language: "cpp",
      is_entry_point: true,
      content: `// CodeForge C++ Starter
#include <iostream>
#include <vector>
#include <unordered_map>

std::vector<int> twoSum(const std::vector<int>& nums, int target) {
    std::unordered_map<int, int> map;
    for (int i = 0; i < nums.size(); ++i) {
        int complement = target - nums[i];
        if (map.find(complement) != map.end()) {
            return {map[complement], i};
        }
        map[nums[i]] = i;
    }
    return {};
}

int main() {
    std::vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    std::vector<int> res = twoSum(nums, target);
    
    std::cout << "Indices: [" << res[0] << ", " << res[1] << "]" << std::endl;
    return 0;
}
`,
    },
  ],

  java: [
    {
      name: "Main.java",
      path: "/",
      language: "java",
      is_entry_point: true,
      content: `// CodeForge Java Starter
import java.util.HashMap;
import java.util.Map;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[0];
    }

    public static void main(String[] args) {
        int[] nums = { 2, 7, 11, 15 };
        int target = 9;
        int[] result = twoSum(nums, target);
        System.out.println("Indices: [" + result[0] + ", " + result[1] + "]");
    }
}
`,
    },
  ],
};

function getStarterFiles(template = "javascript") {
  return TEMPLATES[template] || TEMPLATES.javascript;
}

module.exports = {
  getStarterFiles,
};

