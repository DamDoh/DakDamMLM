export declare class FileEncryptionService {
    private algorithm;
    private keyLength;
    private ivLength;
    private tagLength;
    private getEncryptionKey;
    encryptAndStoreFile(buffer: Buffer, filename: string, userId: string): Promise<string>;
    decryptFile(encryptedPath: string): Promise<Buffer>;
    deleteFile(encryptedPath: string): Promise<void>;
    getFileMetadata(encryptedPath: string): Promise<any>;
    generateFileKey(): string;
    encryptFileKey(fileKey: string): string;
    decryptFileKey(encryptedFileKey: string): string;
    validateFileIntegrity(encryptedPath: string): Promise<boolean>;
}
//# sourceMappingURL=FileEncryptionService.d.ts.map