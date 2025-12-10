// utils/initialFile.js
import { v4 as uuidv4 } from "uuid";

const initialCode = `
#include <bits/stdc++.h>
using namespace std;
#define int long long

void shm8bank() {
    cout<<"Hello world"<<endl;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t=1;
    while (t--) shm8bank();
    return 0;
}

void helperFunction() {
    cout << "Helper function" << endl;
}

void anotherFunction() {
    cout << "Another function" << endl;
}
`;
const initialFile = {
    id: uuidv4(),
    name: "Practice.cpp",
    content: initialCode,
};

export default initialFile;